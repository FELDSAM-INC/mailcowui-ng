// Shared rules of the UI 006 handlers (research R28): who reaches which quarantine item, mailbox,
// domain or alias domain, the permission flags of API 006, version checks, and the audit records the
// API writes for each change (the detail keys of `docs/audit-events.md`).
import type { AuditEvent, AuditTarget, PermissionFlags } from '@/api'

import { asciiName } from '../factories/domain'
import { requestId, ulid } from '../factories/ids'
import { addressOf, normaliseAddress } from '../factories/mailbox'
import type {
  MockAccount,
  MockAliasDomain,
  MockDomain,
  MockMailbox,
  ScenarioState,
} from '../scenarios/state'
import { problem } from './context'
import { ensureMailboxes } from './mailbox-rules'

export const nowIso = (state: ScenarioState) => new Date(state.now()).toISOString()

export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

// ---------------------------------------------------------------------------------------------
// Flags and refusals

/** Administrators hold every flag; others hold what their identity grants. */
export const hasFlag = (account: MockAccount, flag: keyof PermissionFlags) =>
  account.role === 'admin' || !!account.permissions[flag]

export const forbidden = () => problem(403, 'forbidden')
export const notFound = () => problem(404, null)
export const outdated = () => problem(412, null)

export function flagRequired(...requiredFlags: (keyof PermissionFlags)[]): Response {
  return problem(403, 'permission-flag-required', { requiredFlags })
}

export function temporaryFailure(
  dependency: 'sharedStore' | 'spamFilter' | 'mailServer',
  step?: 'delivery' | 'learning',
  retryAfter = 30,
): Response {
  return problem(
    503,
    'temporary-failure',
    { dependency, ...(step ? { step } : {}) },
    { 'Retry-After': String(retryAfter) },
  )
}

const bare = (value: string) => value.trim().replaceAll('"', '')

/** `If-Match` that names another version (`*` matches every version). */
export function ifMatchFails(header: string | null, etag: string): boolean {
  if (header === null) return false
  return header.trim() !== '*' && bare(header) !== bare(etag)
}

/** A bulk target's version that no longer matches (absent versions are not checked). */
export const versionFails = (version: string | undefined, etag: string) =>
  version !== undefined && bare(version) !== bare(etag)

export function bulkRequestId(state: ScenarioState): string {
  return Buffer.from(`q${state.now()}${Math.random()}`).toString('hex').padEnd(32, '0').slice(0, 32)
}

// ---------------------------------------------------------------------------------------------
// Scope

/** Whether the account reaches quarantine items of a recipient (API 006 FR-001). */
export function reachesRecipient(account: MockAccount, recipient: string): boolean {
  const address = recipient.toLowerCase()
  if (account.role === 'admin') return true
  if (account.role === 'mailboxUser') return account.username.toLowerCase() === address
  if (account.scope.type !== 'domains') return false
  const domain = address.slice(address.lastIndexOf('@') + 1)
  return account.scope.domains.includes(domain)
}

/** A stored mailbox (never a resource) the account reaches, by any spelling of its address. */
export function mailboxFor(
  state: ScenarioState,
  account: MockAccount,
  raw: string,
): MockMailbox | undefined {
  ensureMailboxes(state)
  const wanted = normaliseAddress(safeDecode(raw))
  const mailbox = state.mailboxes.find((item) => addressOf(item) === wanted)
  if (!mailbox) return undefined
  if (account.role === 'admin') return mailbox
  if (account.role === 'mailboxUser') {
    return account.username.toLowerCase() === wanted ? mailbox : undefined
  }
  return account.scope.type === 'domains' && account.scope.domains.includes(mailbox.domain)
    ? mailbox
    : undefined
}

/** A domain (not an alias domain) a manager reaches. */
export function domainFor(
  state: ScenarioState,
  account: MockAccount,
  raw: string,
): MockDomain | undefined {
  const name = asciiName(safeDecode(raw))
  const domain = name ? state.domains.find((item) => item.name === name) : undefined
  if (!domain) return undefined
  if (account.role === 'admin') return domain
  return account.scope.type === 'domains' && account.scope.domains.includes(domain.name)
    ? domain
    : undefined
}

/** An alias domain whose target domain a manager reaches. */
export function aliasDomainFor(
  state: ScenarioState,
  account: MockAccount,
  raw: string,
): MockAliasDomain | undefined {
  const name = asciiName(safeDecode(raw))
  const item = name ? state.aliasDomains.find((entry) => entry.name === name) : undefined
  if (!item) return undefined
  if (account.role === 'admin') return item
  return account.scope.type === 'domains' && account.scope.domains.includes(item.target)
    ? item
    : undefined
}

/** The domains and alias domains that exist (for stale excluded domains). */
export function knownDomainNames(state: ScenarioState): Set<string> {
  return new Set([
    ...state.domains.map((domain) => domain.name),
    ...state.aliasDomains.map((item) => item.name),
  ])
}

// ---------------------------------------------------------------------------------------------
// Audit records

/** Writes the audit record the API writes for a change or a refusal. */
export function audit(
  state: ScenarioState,
  account: MockAccount,
  record: {
    eventType: AuditEvent['eventType']
    target: AuditTarget | null
    details?: Record<string, unknown>
    failureReason?: AuditEvent['failureReason']
  },
): void {
  state.auditEvents.push({
    id: ulid(),
    occurredAt: nowIso(state),
    eventType: record.eventType,
    outcome: record.failureReason ? 'failure' : 'success',
    actor: { username: account.username, role: account.role, apiKeyId: null },
    target: record.target,
    clientAddress: '192.0.2.10',
    userAgent: 'Mozilla/5.0 (mock)',
    authMethod: state.session.authMethod,
    failureReason: record.failureReason ?? null,
    requestId: requestId(),
    details: record.details ?? {},
  })
}
