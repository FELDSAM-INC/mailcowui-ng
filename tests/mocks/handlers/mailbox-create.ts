// `createMailbox` (UI 003 T061, research R20): the local part trimmed and lower-cased; values from
// the named template (or the built-in defaults), then the request's; the quota against the domain's
// largest new mailbox quota (`outOfRange` with `limit`); `mailbox-limit-reached`; `address-in-use`
// naming the holder; a domain administrator's unlimited quota or protocol change without the flag
// (`attribute-not-permitted`, a value equal to the template is not a choice); the password policy
// with pre-hashed values stored as given; a password with an external source (`conflictsWith`); an
// unknown template; and 201 with the creation report (injectable outcomes), `Location` and `ETag`.
import type { MailboxCreateRequest, MailboxCreationReport, Writable } from '@/api'

import { aliasAddresses, domainUsage, normaliseTags } from '../factories/domain'
import {
  addressOf,
  defaultUserPermissions,
  mockMailbox,
  syncDomainUsage,
  mailboxView,
} from '../factories/mailbox'
import { passwordViolations } from '../factories/password-policy'
import type { MockMailbox, ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem, scenario } from './context'
import {
  addViolation,
  findInScope,
  requireManager,
  validationFailed,
  type Violations,
} from './domain-rules'
import { checkLocalPart, isPreHashed } from './mailbox-rules'

type Request = Writable<MailboxCreateRequest>

function holderOf(state: ScenarioState, address: string): 'mailbox' | 'alias' | null {
  if (state.mailboxes.some((mailbox) => addressOf(mailbox) === address)) return 'mailbox'
  const domain = state.domains.find((item) => item.name === address.split('@')[1])
  return domain && aliasAddresses(domain).includes(address) ? 'alias' : null
}

function report(state: ScenarioState, mailbox: MockMailbox): MailboxCreationReport {
  const computed: Omit<MailboxCreationReport, 'messages'> = {
    groupwareDirectoryUpdate:
      mailbox.status !== 'active'
        ? 'notRequired'
        : state.mailboxCapabilities.groupwareEnabled
          ? 'done'
          : 'groupwareDisabled',
    rateLimit: mailbox.rateLimit ? 'applied' : 'notRequested',
    taggedMailHandling: mailbox.taggedMailHandling === 'none' ? 'notRequested' : 'applied',
  }
  const outcomes = { ...computed, ...state.mailboxCreationReport }
  const messages = Object.fromEntries(
    Object.entries(outcomes)
      .filter(([, outcome]) => outcome === 'failed')
      .map(([step]) => [step, `${step} failed`]),
  )
  return { ...outcomes, ...(Object.keys(messages).length > 0 ? { messages } : {}) }
}

export const mailboxCreateHandlers = [
  http.post('/mailboxes', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const body = (await request.json()) as Request
    const errors: Violations = {}
    const domain = findInScope(state, account, body.domain)
    if (!domain) addViolation(errors, 'domain', 'notFound')
    const localPart = checkLocalPart(errors, 'localPart', body.localPart, domain?.name ?? 'x')
    const template =
      body.templateId === undefined
        ? undefined
        : state.mailboxTemplates.find((item) => item.id === body.templateId)
    if (body.templateId !== undefined && !template) addViolation(errors, 'templateId', 'notFound')
    const base = template ?? {
      ...state.mailboxCapabilities.templateDefaults,
      userPermissions: {
        ...defaultUserPermissions(),
        ...state.mailboxCapabilities.templateDefaults.userPermissions,
      },
    }
    const authSource = body.authSource ?? 'mailcow'
    if (authSource !== 'mailcow' && body.password !== undefined) {
      addViolation(errors, 'password', 'conflictsWith', { field: 'authSource' })
    } else if (authSource === 'mailcow') {
      if (!body.password) addViolation(errors, 'password', 'required')
      else if (!isPreHashed(state, body.password)) {
        for (const violation of passwordViolations(state.passwordPolicy, body.password)) {
          addViolation(errors, 'password', violation.code, violation.params)
        }
      }
    }
    const quota = body.quota ?? base.quota
    if (domain && Object.keys(errors).length === 0) {
      const usage = domainUsage(state, domain)
      if (quota !== 0 && quota > usage.maxNewMailboxQuota) {
        addViolation(errors, 'quota', 'outOfRange', {
          min: 0,
          max: usage.maxNewMailboxQuota,
          limit:
            usage.maxNewMailboxQuota < domain.maxMailboxQuota
              ? 'domainQuotaLeft'
              : 'maxMailboxQuota',
        })
      }
    }
    if (Object.keys(errors).length > 0 || !domain) return response.untyped(validationFailed(errors))

    if (account.role !== 'admin') {
      const attributes: Record<string, string> = {}
      if (quota === 0 && base.quota !== 0 && !account.permissions.unlimitedQuota) {
        attributes.quota = 'unlimitedQuota'
      }
      for (const [protocol, value] of Object.entries(body.protocolAccess ?? {})) {
        const current = base.protocolAccess[protocol as keyof typeof base.protocolAccess]
        if (value !== current && !account.permissions.protocolAccess) {
          attributes[`protocolAccess.${protocol}`] = 'protocolAccess'
        }
      }
      if (Object.keys(attributes).length > 0) {
        return response.untyped(
          problem(403, 'attribute-not-permitted', {
            attributes: Object.keys(attributes),
            requiredFlags: attributes,
          }),
        )
      }
    }
    if (domain.usage.mailboxes >= domain.maxMailboxes) {
      return response.untyped(
        problem(409, 'mailbox-limit-reached', {
          domain: domain.name,
          count: domain.usage.mailboxes,
          limit: domain.maxMailboxes,
        }),
      )
    }
    const address = `${localPart}@${domain.name}`
    const holder = holderOf(state, address)
    if (holder) return response.untyped(problem(409, 'address-in-use', { address, holder }))

    const mailbox = mockMailbox({
      localPart,
      domain: domain.name,
      displayName: body.displayName?.trim() || localPart,
      authSource,
      hasPassword: authSource === 'mailcow',
      quota,
      status: body.status ?? base.status,
      forcePasswordChange: body.forcePasswordChange ?? base.forcePasswordChange,
      forceSecondFactorSetup: body.forceSecondFactorSetup ?? base.forceSecondFactorSetup,
      webmailRedirect: body.webmailRedirect ?? base.webmailRedirect,
      protocolAccess: { ...base.protocolAccess, ...body.protocolAccess },
      userPermissions: {
        ...defaultUserPermissions(),
        ...base.userPermissions,
        ...body.userPermissions,
      },
      tags: normaliseTags(body.tags ?? base.tags),
      taggedMailHandling: body.taggedMailHandling ?? base.taggedMailHandling,
      quarantineNotification: body.quarantineNotification ?? base.quarantineNotification,
      quarantineCategory: body.quarantineCategory ?? base.quarantineCategory,
      tlsEnforceInbound: body.tlsEnforceInbound ?? base.tlsEnforceInbound,
      tlsEnforceOutbound: body.tlsEnforceOutbound ?? base.tlsEnforceOutbound,
      rateLimit: body.rateLimit === undefined ? base.rateLimit : body.rateLimit,
      passwordChangedAt: new Date(state.now()).toISOString(),
      createdAt: new Date(state.now()).toISOString(),
    })
    state.mailboxes.push(mailbox)
    syncDomainUsage(state, domain.name)
    const data = { ...mailboxView(state, mailbox, account), creationReport: report(state, mailbox) }
    return response(201).json({ data } as never, {
      headers: { ETag: data.etag, Location: `/api/v2/mailboxes/${data.address}` },
    })
  }),
]
