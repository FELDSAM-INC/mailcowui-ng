// Sender settings handlers (UI 004 T017, research R21; API research R14, R15): what a mailbox may
// send as, the whole-set replacement of its explicit permissions and external sender addresses
// (entries already stored accepted as they are, a domain administrator's entries outside their
// scope kept, `*` alone and for administrators only, aliases that already let the mailbox send not
// stored, local domains refused as external, `extendSenderAcl` for changed external addresses), and
// the paged list of entries that could be granted.
import type { MailboxSenderPermissionCandidate } from '@/api'

import { domainPart, readableAddress } from '../factories/alias'
import { rowsOf } from '../factories/sender-acl'
import { csrfProblem, http, problem, scenario } from './context'
import {
  addViolation,
  notFound,
  outdated,
  page,
  requireManager,
  validationFailed,
  type Violations,
} from './domain-rules'
import {
  aliasDomainAddressesOf,
  aliasDomainInScope,
  allMailboxes,
  allowedThroughAliases,
  aliasInScope,
  changeable,
  compareText,
  deliversTo,
  domainInScope,
  explicitEntry,
  externalEntry,
  findAliasDomain,
  findDomain,
  hasAliasRow,
  ifMatchFails,
  mailboxFor,
  reachesDomain,
  senderSettingsView,
  storedEntry,
} from './feature-004-rules'

const etagHeaders = (etag: string) => ({ headers: { ETag: etag } })

const sameSet = (a: readonly string[], b: readonly string[]) => {
  const left = [...new Set(a.map((item) => item.toLowerCase()))].sort()
  const right = [...new Set(b.map((item) => item.toLowerCase()))].sort()
  return JSON.stringify(left) === JSON.stringify(right)
}

const RANK = { anyAddress: 0, domain: 1, address: 2 } as const

export const senderSettingsHandlers = [
  http.get('/mailboxes/{mailbox}/sender-settings', ({ params, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const mailbox = mailboxFor(state, account, params.mailbox)
    if (!mailbox) return response.untyped(notFound())
    const data = senderSettingsView(state, account, mailbox)
    return response(200).json({ data }, etagHeaders(data.etag))
  }),

  http.patch('/mailboxes/{mailbox}/sender-settings', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const mailbox = mailboxFor(state, account, params.mailbox)
    if (!mailbox) return response.untyped(notFound())
    const current = senderSettingsView(state, account, mailbox)
    if (ifMatchFails(request.headers.get('if-match'), current.etag)) {
      return response.untyped(outdated())
    }
    const body = await request.json()
    const rows = rowsOf(state.senderAcl, mailbox)
    const storedExplicit = rows.filter((row) => !row.external).map((row) => row.sendAs)
    const storedExternal = rows.filter((row) => row.external).map((row) => row.sendAs)
    const errors: Violations = {}

    let explicit: string[] | null = null
    if (body.explicitPermissions !== undefined) {
      const storedByKey = new Map<string, string>()
      for (const value of storedExplicit) {
        if (!storedByKey.has(value.toLowerCase())) storedByKey.set(value.toLowerCase(), value)
      }
      const result: string[] = []
      body.explicitPermissions.forEach((raw, index) => {
        const entry = explicitEntry(raw)
        const path = `explicitPermissions.${index}`
        if (!entry) {
          addViolation(errors, path, 'invalidFormat', { format: 'senderPermission' })
          return
        }
        const stored = storedByKey.get(entry.value.toLowerCase())
        if (stored) {
          result.push(stored)
          return
        }
        if (entry.type === 'anyAddress') {
          if (account.role !== 'admin') {
            addViolation(errors, path, 'notEligible', { allowedRoles: ['admin'] })
            return
          }
        } else if (entry.type === 'domain') {
          if (!reachesDomain(state, account, entry.value.slice(1))) {
            addViolation(errors, path, 'notFound', { resource: 'domain' })
            return
          }
        } else if (
          !hasAliasRow(state, entry.value) ||
          !reachesDomain(state, account, domainPart(entry.value))
        ) {
          addViolation(errors, path, 'notFound', { resource: 'address' })
          return
        }
        result.push(entry.value)
      })
      for (const value of storedExplicit) {
        if (!changeable(state, account, storedEntry(value))) result.push(value)
      }
      const unique = new Map<string, string>()
      for (const value of result)
        if (!unique.has(value.toLowerCase())) unique.set(value.toLowerCase(), value)
      if (unique.has('*')) explicit = ['*']
      else {
        const redundant = new Set(allowedThroughAliases(state, mailbox))
        explicit = [...unique.values()].filter((value) => !redundant.has(value.toLowerCase()))
      }
    }

    let external: string[] | null = null
    if (body.externalSenderAddresses !== undefined) {
      const unique = new Map<string, string>()
      body.externalSenderAddresses.forEach((raw, index) => {
        const entry = externalEntry(raw)
        const path = `externalSenderAddresses.${index}`
        if (!entry) {
          addViolation(errors, path, 'invalidFormat', { format: 'emailOrDomain' })
          return
        }
        if (findDomain(state, entry.domain) || findAliasDomain(state, entry.domain)) {
          addViolation(errors, path, 'notEligible', { kind: 'localDomain' })
          return
        }
        if (!unique.has(entry.value.toLowerCase()))
          unique.set(entry.value.toLowerCase(), entry.value)
      })
      external = [...unique.values()]
    }
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    if (
      external !== null &&
      account.role !== 'admin' &&
      !sameSet(external, storedExternal) &&
      !account.permissions.extendSenderAcl
    ) {
      return response.untyped(
        problem(403, 'attribute-not-permitted', {
          attributes: ['externalSenderAddresses'],
          requiredFlags: { externalSenderAddresses: 'extendSenderAcl' },
        }),
      )
    }
    const key = mailbox.toLowerCase()
    if (explicit !== null) {
      state.senderAcl = [
        ...state.senderAcl.filter((row) => row.external || row.mailbox.toLowerCase() !== key),
        ...explicit.map((sendAs) => ({ mailbox, sendAs, external: false })),
      ]
    }
    if (external !== null) {
      state.senderAcl = [
        ...state.senderAcl.filter((row) => !row.external || row.mailbox.toLowerCase() !== key),
        ...external.map((sendAs) => ({ mailbox, sendAs, external: true })),
      ]
    }
    const data = senderSettingsView(state, account, mailbox)
    return response(200).json({ data }, etagHeaders(data.etag))
  }),

  http.get('/sender-permission-candidates', ({ request, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    const params = url.searchParams
    const mailbox = mailboxFor(state, account, params.get('mailbox') ?? '')
    if (!mailbox) {
      const errors: Violations = {}
      addViolation(errors, 'mailbox', 'notFound', { resource: 'mailbox' })
      return response.untyped(validationFailed(errors))
    }
    const held = new Set(
      rowsOf(state.senderAcl, mailbox)
        .filter((row) => !row.external)
        .map((row) => row.sendAs.toLowerCase()),
    )
    const types = params.getAll('type')
    const wants = (type: string) => types.length === 0 || types.includes(type)
    const items: MailboxSenderPermissionCandidate[] = []
    if (wants('anyAddress') && account.role === 'admin' && !held.has('*')) {
      items.push({ value: '*', valueUnicode: '*', type: 'anyAddress', kind: 'anyAddress' })
    }
    if (wants('domain')) {
      for (const domain of state.domains) {
        const value = `@${domain.name}`
        if (domainInScope(state, account, domain.name) && !held.has(value)) {
          items.push({
            value,
            valueUnicode: readableAddress(value),
            type: 'domain',
            kind: 'domain',
          })
        }
      }
      for (const item of state.aliasDomains) {
        const value = `@${item.name}`
        if (aliasDomainInScope(state, account, item) && !held.has(value)) {
          items.push({
            value,
            valueUnicode: readableAddress(value),
            type: 'domain',
            kind: 'aliasDomain',
          })
        }
      }
    }
    if (wants('address')) {
      const excluded = new Set([
        mailbox.toLowerCase(),
        ...aliasDomainAddressesOf(state, mailbox).map((address) => address.toLowerCase()),
        ...held,
      ])
      const mailboxes = allMailboxes(state).filter((address) =>
        domainInScope(state, account, domainPart(address)),
      )
      const mailboxKeys = new Set(mailboxes.map((address) => address.toLowerCase()))
      for (const address of mailboxes) {
        if (!excluded.has(address.toLowerCase())) {
          items.push({
            value: address,
            valueUnicode: readableAddress(address),
            type: 'address',
            kind: 'mailbox',
          })
        }
      }
      for (const alias of state.aliases) {
        const key = alias.address.toLowerCase()
        if (alias.address.startsWith('@') || excluded.has(key) || mailboxKeys.has(key)) continue
        if (deliversTo(alias, mailbox) || !aliasInScope(state, account, alias)) continue
        if (!reachesDomain(state, account, domainPart(alias.address))) continue
        items.push({
          value: alias.address,
          valueUnicode: readableAddress(alias.address),
          type: 'address',
          kind: 'alias',
        })
      }
    }
    const q = params.get('q')?.trim().toLowerCase()
    let result = q ? items.filter((item) => item.value.toLowerCase().includes(q)) : items
    const sort = params.get('sort') ?? 'type'
    const direction = params.get('order') === 'desc' ? -1 : 1
    result = [...result].sort(
      (a, b) =>
        direction *
        ((sort === 'type' ? RANK[a.type] - RANK[b.type] : 0) || compareText(a.value, b.value)),
    )
    const pageResult = page(result, url)
    return response(200).json({ data: pageResult.data, meta: pageResult.meta })
  }),
]
