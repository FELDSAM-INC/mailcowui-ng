// `updateMailbox` (UI 003 T011, research R20), complete, so that US3 and US5 use it unchanged:
// JSON Merge Patch with nested `protocolAccess` and `userPermissions`, `tags` replaced as a
// case-insensitive set keeping the first spelling, `customAttributes` added, replaced or removed
// by name; `If-Match` with 412; `immutable` for read-only members; the quota against
// `largestAllowedQuota` (a quota below the usage is accepted); the password policy, pre-hashed
// values and external sources; the recovery e-mail; and the domain administrator's flags with
// `attribute-not-permitted`, where a value equal to the current one is not a choice.
import type { MailboxPatch, MailboxUserPermissions, Writable } from '@/api'

type Patch = Writable<MailboxPatch>

import { normaliseTags } from '../factories/domain'
import { addressOf, largestAllowedQuota, mailboxEtag, mailboxView } from '../factories/mailbox'
import { passwordViolations } from '../factories/password-policy'
import type { MockAccount, MockMailbox, ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem, scenario } from './context'
import {
  addViolation,
  notFound,
  outdated,
  requireManager,
  validationFailed,
  type Violations,
} from './domain-rules'
import {
  checkTagLimit,
  EMAIL,
  findMailbox,
  isPreHashed,
  mailboxFailure,
  missingPermissionFlags,
} from './mailbox-rules'

const PATCHABLE = new Set([
  'displayName',
  'status',
  'quota',
  'password',
  'forcePasswordChange',
  'forceSecondFactorSetup',
  'webmailRedirect',
  'protocolAccess',
  'authSource',
  'recoveryEmail',
  'tags',
  'userPermissions',
  'customAttributes',
])

const ATTRIBUTE_NAME = /^\S+$/

type Flag =
  | 'unlimitedQuota'
  | 'protocolAccess'
  | 'sogoAccess'
  | 'ratelimit'
  | 'syncjobs'
  | 'quarantine'
  | 'appPasswds'
  | 'pushover'
  | 'spamPolicy'

/** The attributes a domain administrator would change without the flag, with that flag. */
function notPermitted(
  account: MockAccount,
  mailbox: MockMailbox,
  body: Patch,
): Record<string, Flag> {
  const refused: Record<string, Flag> = {}
  if (account.role === 'admin') return refused
  const flags = account.permissions
  if (body.quota === 0 && mailbox.quota !== 0 && !flags.unlimitedQuota) {
    refused.quota = 'unlimitedQuota'
  }
  for (const [protocol, value] of Object.entries(body.protocolAccess ?? {})) {
    const current = mailbox.protocolAccess[protocol as keyof MockMailbox['protocolAccess']]
    if (value !== current && !flags.protocolAccess) {
      refused[`protocolAccess.${protocol}`] = 'protocolAccess'
    }
  }
  if (
    body.webmailRedirect !== undefined &&
    body.webmailRedirect !== mailbox.webmailRedirect &&
    !flags.sogoAccess
  ) {
    refused.webmailRedirect = 'sogoAccess'
  }
  const missing = missingPermissionFlags(account)
  for (const [key, value] of Object.entries(body.userPermissions ?? {})) {
    const permission = key as keyof MailboxUserPermissions
    if (missing.has(permission) && value !== mailbox.userPermissions[permission]) {
      refused[`userPermissions.${key}`] = permission as Flag
    }
  }
  return refused
}

function validate(state: ScenarioState, mailbox: MockMailbox, body: Patch): Violations {
  const errors: Violations = {}
  for (const key of Object.keys(body)) {
    if (!PATCHABLE.has(key)) addViolation(errors, key, 'immutable')
  }
  const capabilities = state.mailboxCapabilities
  const source = body.authSource ?? mailbox.authSource
  if (body.authSource !== undefined && body.authSource !== mailbox.authSource) {
    if (!capabilities.authSources.includes(body.authSource)) {
      addViolation(errors, 'authSource', 'notInList', { allowed: capabilities.authSources })
    }
  }
  if (body.quota !== undefined && body.quota !== 0) {
    const max = largestAllowedQuota(state, mailbox)
    if (body.quota > max && body.quota !== mailbox.quota) {
      addViolation(errors, 'quota', 'outOfRange', {
        min: 0,
        max,
        limit: 'largestAllowedQuota',
      })
    }
  }
  if (body.password !== undefined) {
    if (source !== 'mailcow') {
      addViolation(errors, 'password', 'conflictsWith', { field: 'authSource', value: source })
    } else if (!isPreHashed(state, body.password)) {
      for (const violation of passwordViolations(state.passwordPolicy, body.password)) {
        addViolation(errors, 'password', violation.code, violation.params)
      }
    }
  } else if (
    body.authSource === 'mailcow' &&
    mailbox.authSource !== 'mailcow' &&
    !mailbox.hasPassword
  ) {
    addViolation(errors, 'password', 'required')
  }
  if (body.forcePasswordChange === true && source !== 'mailcow') {
    addViolation(errors, 'forcePasswordChange', 'conflictsWith', {
      field: 'authSource',
      value: source,
    })
  }
  if (body.forceSecondFactorSetup === true && source === 'genericOidc') {
    addViolation(errors, 'forceSecondFactorSetup', 'conflictsWith', {
      field: 'authSource',
      value: source,
    })
  }
  if (
    body.recoveryEmail !== undefined &&
    body.recoveryEmail !== null &&
    body.recoveryEmail !== ''
  ) {
    if (source !== 'mailcow') {
      addViolation(errors, 'recoveryEmail', 'conflictsWith', {
        field: 'authSource',
        value: source,
      })
    } else if (!EMAIL.test(body.recoveryEmail)) {
      addViolation(errors, 'recoveryEmail', 'invalidFormat', { format: 'email' })
    }
  }
  if (body.tags !== undefined) {
    checkTagLimit(errors, capabilities.taggingLimit, normaliseTags(body.tags), mailbox.tags)
  }
  if (body.customAttributes !== undefined) {
    const next = { ...mailbox.customAttributes }
    for (const [name, value] of Object.entries(body.customAttributes)) {
      if (value === null) {
        delete next[name]
        continue
      }
      if (!ATTRIBUTE_NAME.test(name)) {
        addViolation(errors, `customAttributes.${name}`, 'invalidFormat', {
          format: 'attributeName',
        })
      }
      next[name] = value
    }
    const count = Object.keys(next).length
    if (
      count > capabilities.customAttributeLimit &&
      count > Object.keys(mailbox.customAttributes).length
    ) {
      addViolation(errors, 'customAttributes', 'tooMany', {
        max: capabilities.customAttributeLimit,
      })
    }
  }
  return errors
}

function apply(state: ScenarioState, mailbox: MockMailbox, body: Patch): void {
  const now = new Date(state.now()).toISOString()
  if (body.displayName !== undefined) {
    const name = body.displayName.replace(/^</, '').replace(/>$/, '')
    mailbox.displayName = name === '' ? mailbox.localPart : name
  }
  if (body.status !== undefined) mailbox.status = body.status
  if (body.quota !== undefined && body.quota !== mailbox.quota) {
    const domain = state.domains.find((item) => item.name === mailbox.domain)
    if (domain) {
      domain.usage = {
        ...domain.usage,
        quotaAllocated: Math.max(0, domain.usage.quotaAllocated - mailbox.quota + body.quota),
        largestMailboxQuota: Math.max(domain.usage.largestMailboxQuota, body.quota),
      }
    }
    mailbox.quota = body.quota
  }
  if (body.authSource !== undefined && body.authSource !== mailbox.authSource) {
    mailbox.authSource = body.authSource
    if (body.authSource !== 'mailcow') {
      mailbox.forcePasswordChange = false
      mailbox.recoveryEmail = null
      if (body.authSource === 'genericOidc') mailbox.forceSecondFactorSetup = false
    }
  }
  if (body.password !== undefined) {
    mailbox.hasPassword = true
    mailbox.passwordChangedAt = now
  }
  if (body.forcePasswordChange !== undefined) mailbox.forcePasswordChange = body.forcePasswordChange
  if (body.forceSecondFactorSetup !== undefined) {
    mailbox.forceSecondFactorSetup = body.forceSecondFactorSetup
  }
  if (body.webmailRedirect !== undefined) mailbox.webmailRedirect = body.webmailRedirect
  if (body.protocolAccess)
    mailbox.protocolAccess = { ...mailbox.protocolAccess, ...body.protocolAccess }
  if (body.userPermissions) {
    mailbox.userPermissions = { ...mailbox.userPermissions, ...body.userPermissions }
  }
  if (body.recoveryEmail !== undefined) {
    mailbox.recoveryEmail = body.recoveryEmail === '' ? null : body.recoveryEmail
  }
  if (body.tags !== undefined) mailbox.tags = normaliseTags(body.tags)
  if (body.customAttributes !== undefined) {
    const next = { ...mailbox.customAttributes }
    for (const [name, value] of Object.entries(body.customAttributes)) {
      if (value === null) delete next[name]
      else next[name] = value
    }
    mailbox.customAttributes = next
  }
  mailbox.modifiedAt = now
}

export const mailboxUpdateHandlers = [
  http.patch('/mailboxes/{mailbox}', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const mailbox = findMailbox(state, account, params.mailbox)
    if (!mailbox) return response.untyped(notFound())
    const failure = mailboxFailure(state, addressOf(mailbox), 'updateMailbox')
    if (failure) return response.untyped(failure)
    const ifMatch = request.headers.get('if-match')
    if (ifMatch !== null && ifMatch !== mailboxEtag(mailbox)) return response.untyped(outdated())
    const body = (await request.json()) as Patch

    const attributes = notPermitted(account, mailbox, body)
    if (Object.keys(attributes).length > 0) {
      return response.untyped(
        problem(403, 'attribute-not-permitted', {
          attributes: Object.keys(attributes),
          requiredFlags: attributes,
        }),
      )
    }
    const errors = validate(state, mailbox, body)
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    apply(state, mailbox, body)
    const data = mailboxView(state, mailbox, account)
    return response(200).json({ data } as never, { headers: { ETag: data.etag } })
  }),
]
