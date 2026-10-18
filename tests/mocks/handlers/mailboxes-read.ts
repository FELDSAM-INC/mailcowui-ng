// Mailbox reads (UI 003 T011, research R20): `listMailboxes` with scope, the literal search over
// address, display name and tags, the repeatable filters, every sort field with missing values last
// in both directions, and paging; `getMailbox` with its ETag; `getMailboxCapabilities`; and
// `listMailboxTags`, the distinct tags in scope with letter-case variants merged.
import type { MailboxTagUsage } from '@/api'

import { asciiName, readableName } from '../factories/domain'
import {
  addressOf,
  defaultUserPermissions,
  mailboxView,
  visiblePermissions,
} from '../factories/mailbox'
import type { MockMailbox } from '../scenarios/state'
import { http, scenario } from './context'
import { notFound, page, requireManager } from './domain-rules'
import { findMailbox, mailboxesInScope, mailboxFailure } from './mailbox-rules'

const defaultUserPermissionsFrom = (
  permissions: Partial<ReturnType<typeof defaultUserPermissions>>,
) => ({ ...defaultUserPermissions(), ...permissions })

const newestLogin = (mailbox: MockMailbox): string | null => {
  const times = [mailbox.lastLogins.imap, mailbox.lastLogins.pop3, mailbox.lastLogins.smtp].filter(
    (value): value is string => value !== null,
  )
  return times.length > 0 ? times.sort().at(-1)! : null
}

const SORT_VALUE: Record<string, (mailbox: MockMailbox) => string | number | null> = {
  address: (m) => addressOf(m),
  displayName: (m) => m.displayName.toLowerCase(),
  domain: (m) => readableName(m.domain),
  status: (m) => m.status,
  quota: (m) => (m.quota === 0 ? null : m.quota),
  quotaUsed: (m) => m.quotaUsed,
  percentUsed: (m) => (m.quota === 0 ? null : m.quotaUsed / m.quota),
  messageCount: (m) => m.messageCount,
  lastMailLogin: (m) => newestLogin(m),
  passwordChangedAt: (m) => m.passwordChangedAt,
  createdAt: (m) => m.createdAt,
  modifiedAt: (m) => m.modifiedAt,
}

function compare(a: string | number | null, b: string | number | null, direction: number): number {
  if (a === b) return 0
  // Missing values sort last in both directions (FR-015).
  if (a === null) return 1
  if (b === null) return -1
  if (typeof a === 'string' && typeof b === 'string') return direction * a.localeCompare(b, 'en')
  return direction * ((a as number) - (b as number))
}

function matchesSearch(mailbox: MockMailbox, q: string): boolean {
  const needle = q.toLowerCase()
  return [addressOf(mailbox), mailbox.displayName, ...mailbox.tags].some((value) =>
    value.toLowerCase().includes(needle),
  )
}

export const mailboxReadHandlers = [
  http.get('/mailboxes', ({ request, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    const params = url.searchParams
    let items = [...mailboxesInScope(state, account)]
    const q = params.get('q')
    if (q) items = items.filter((mailbox) => matchesSearch(mailbox, q))
    const domains = params.getAll('domain').map((name) => asciiName(name) || name.toLowerCase())
    if (domains.length > 0) items = items.filter((mailbox) => domains.includes(mailbox.domain))
    const statuses = params.getAll('status')
    if (statuses.length > 0) items = items.filter((mailbox) => statuses.includes(mailbox.status))
    const tags = params.getAll('tag').map((tag) => tag.toLowerCase())
    if (tags.length > 0) {
      items = items.filter((mailbox) =>
        mailbox.tags.some((tag) => tags.includes(tag.toLowerCase())),
      )
    }
    const sources = params.getAll('authSource')
    if (sources.length > 0) items = items.filter((mailbox) => sources.includes(mailbox.authSource))
    const sort = params.get('sort') ?? 'address'
    const direction = params.get('order') === 'desc' ? -1 : 1
    const value = SORT_VALUE[sort] ?? SORT_VALUE.address!
    const keyed = items.map((mailbox) => ({
      mailbox,
      key: value(mailbox),
      address: addressOf(mailbox),
    }))
    keyed.sort(
      (a, b) => compare(a.key, b.key, direction) || a.address.localeCompare(b.address, 'en'),
    )
    const result = page(
      keyed.map((item) => item.mailbox),
      url,
    )
    return response(200).json({
      data: result.data.map((mailbox) => mailboxView(state, mailbox, account)),
      meta: result.meta,
    } as never)
  }),

  http.get('/mailboxes/{mailbox}', ({ params, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const mailbox = findMailbox(state, account, params.mailbox)
    if (!mailbox) return response.untyped(notFound())
    const failure = mailboxFailure(state, addressOf(mailbox), 'getMailbox')
    if (failure) return response.untyped(failure)
    const data = mailboxView(state, mailbox, account)
    return response(200).json({ data } as never, { headers: { ETag: data.etag } })
  }),

  http.get('/capabilities/mailboxes', ({ response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const data = structuredClone(state.mailboxCapabilities)
    data.templateDefaults.userPermissions = visiblePermissions(
      account,
      defaultUserPermissionsFrom(state.mailboxCapabilities.templateDefaults.userPermissions),
    )
    return response(200).json({ data })
  }),

  http.get('/mailbox-tags', ({ request, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.toLowerCase() ?? ''
    const tags = new Map<string, { name: string; mailboxes: Set<string> }>()
    for (const mailbox of mailboxesInScope(state, account)) {
      for (const tag of mailbox.tags) {
        const key = tag.toLowerCase()
        const entry = tags.get(key) ?? { name: tag, mailboxes: new Set<string>() }
        // The spelling that sorts first in binary order names the merged entry.
        if (tag < entry.name) entry.name = tag
        entry.mailboxes.add(addressOf(mailbox))
        tags.set(key, entry)
      }
    }
    let items: MailboxTagUsage[] = [...tags.values()].map((entry) => ({
      name: entry.name,
      mailboxCount: entry.mailboxes.size,
    }))
    if (q) items = items.filter((item) => item.name.toLowerCase().includes(q))
    const direction = url.searchParams.get('order') === 'desc' ? -1 : 1
    items.sort((a, b) => direction * a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
    return response(200).json(page(items, url))
  }),
]
