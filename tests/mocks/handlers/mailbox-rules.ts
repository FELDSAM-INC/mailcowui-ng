// Shared rules of the mailbox handlers (UI 003 research R20): scope, the mailboxes behind the
// domains' usage counts, address lookup in any letter case and domain form, failure injection by
// mailbox or template, and the value rules of API 003 that several operations share.
import type { MailboxUserPermissions, PermissionFlags } from '@/api'

import { mailboxAddresses } from '../factories/domain'
import { addressOf, mockMailbox, normaliseAddress } from '../factories/mailbox'
import type { MockAccount, MockMailbox, ScenarioState } from '../scenarios/state'
import { problem } from './context'
import { addViolation, scopeOf, type Violations } from './domain-rules'

/**
 * Domains whose usage counts more mailboxes than are stored get the missing ones, named as UI 002
 * names them (`user<n>@domain` or the domain's explicit addresses), so that the domain screens and
 * the mailbox screens show the same mailboxes. The domain's usage figures are left as they are.
 */
export function ensureMailboxes(state: ScenarioState): void {
  const counts = new Map<string, number>()
  for (const mailbox of state.mailboxes) {
    counts.set(mailbox.domain, (counts.get(mailbox.domain) ?? 0) + 1)
  }
  for (const domain of state.domains) {
    // Explicit addresses (UI 002 fixtures) are all materialised; otherwise the usage count is.
    const wanted = domain.mailboxAddresses ? domain.mailboxAddresses.length : domain.usage.mailboxes
    let have = counts.get(domain.name) ?? 0
    if (have >= wanted) continue
    const stored = new Set(
      state.mailboxes.filter((item) => item.domain === domain.name).map(addressOf),
    )
    for (const address of mailboxAddresses(domain)) {
      if (have >= wanted) break
      if (stored.has(address)) continue
      const [localPart = ''] = address.split('@')
      state.mailboxes.push(mockMailbox({ localPart, domain: domain.name }))
      have += 1
    }
  }
}

/** The mailboxes an account may see, in storage order. */
export function mailboxesInScope(state: ScenarioState, account: MockAccount): MockMailbox[] {
  ensureMailboxes(state)
  if (account.role === 'admin') return state.mailboxes
  const names = new Set(scopeOf(state, account).map((domain) => domain.name))
  return state.mailboxes.filter((mailbox) => names.has(mailbox.domain))
}

/** A mailbox of the account's scope by any spelling of its address, or undefined. */
export function findMailbox(
  state: ScenarioState,
  account: MockAccount,
  raw: string,
): MockMailbox | undefined {
  const wanted = normaliseAddress(raw)
  return mailboxesInScope(state, account).find((mailbox) => addressOf(mailbox) === wanted)
}

/** A failure injected for a mailbox or `template:<id>`, consumed when `times` is set. */
export function mailboxFailure(
  state: ScenarioState,
  key: string,
  operationId: string,
): Response | null {
  const failure = state.mailboxFailures[key]
  if (!failure) return null
  if (failure.operations && !failure.operations.includes(operationId)) return null
  if (failure.times !== undefined) {
    if (failure.times <= 0) return null
    failure.times -= 1
  }
  const headers: Record<string, string> =
    failure.status === 503 ? { 'Retry-After': String(failure.retryAfter ?? 30) } : {}
  return problem(failure.status, failure.type ?? null, failure.extra ?? {}, headers)
}

/** Whether a password starts with a hash-scheme prefix legacy recognises (any letter case). */
export function isPreHashed(state: ScenarioState, password: string): boolean {
  const match = /^\{([^}]+)\}/.exec(password)
  if (!match) return false
  const scheme = match[1]!.toUpperCase()
  return state.mailboxCapabilities.preHashedPasswordSchemes.includes(scheme)
}

const LOCAL_PART = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/

/** The local part rules: trimmed and lower-cased, 1–64 characters, no leading, trailing or double dot. */
export function checkLocalPart(
  errors: Violations,
  path: string,
  raw: string,
  domain: string,
): string {
  const localPart = raw.trim().toLowerCase()
  if (localPart === '') addViolation(errors, path, 'required')
  else if (localPart.length > 64 || !LOCAL_PART.test(localPart)) {
    addViolation(errors, path, 'invalidFormat', { format: 'localPart' })
  } else if (`${localPart}@${domain}`.length > 255) {
    addViolation(errors, path, 'invalidFormat', { format: 'email' })
  }
  return localPart
}

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The overlapping user permission flags a domain administrator lacks. */
export function missingPermissionFlags(account: MockAccount): Set<keyof MailboxUserPermissions> {
  const missing = new Set<keyof MailboxUserPermissions>()
  if (account.role === 'admin') return missing
  for (const flag of [
    'syncjobs',
    'quarantine',
    'appPasswds',
    'pushover',
    'spamPolicy',
  ] as const satisfies readonly (keyof PermissionFlags & keyof MailboxUserPermissions)[]) {
    if (!account.permissions[flag]) missing.add(flag)
  }
  return missing
}

/** `tooMany` above the tagging limit, unless the set is the stored one or smaller. */
export function checkTagLimit(
  errors: Violations,
  limit: number,
  tags: string[],
  current: string[],
): void {
  if (tags.length > limit && tags.length >= current.length) {
    const same =
      tags.length === current.length &&
      tags.every((tag) => current.some((item) => item.toLowerCase() === tag.toLowerCase()))
    if (!same) addViolation(errors, 'tags', 'tooMany', { max: limit })
  }
}

export const bareVersion = (etag: string) => etag.replaceAll('"', '')

export function bulkRequestId(state: ScenarioState): string {
  return Buffer.from(String(state.now())).toString('hex').padEnd(32, '0').slice(0, 32)
}
