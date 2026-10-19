// Shared rules of the self-service handlers (UI 005 T012, research R24): who may reach which
// mailbox, the permission flags of each change, version checks and temporary failures.
import { HttpResponse } from 'msw'

import type { PermissionFlags } from '@/api'

import { addressOf, normaliseAddress } from '../../factories/mailbox'
import type { SelfServiceDependency } from '../../scenarios/self-service/state'
import type { MockAccount, MockMailbox, ScenarioState } from '../../scenarios/state'
import { problem } from '../context'
import { mailboxesInScope } from '../mailbox-rules'

export const notFound = () => problem(404, null)
export const outdated = () => problem(412, null)
export const forbidden = () => problem(403, 'forbidden')

/** Flags whose change a domain administrator needs its own `da_acl` flag for (FR-004). */
const DOMAIN_ADMIN_FLAGS = new Set<keyof PermissionFlags>(['appPasswds', 'pushover', 'filters'])

/**
 * The mailbox an account may reach: its own for mailbox users, any in scope for administrators and
 * domain administrators; 404 otherwise (the API does not reveal mailboxes outside the scope).
 */
export function reachMailbox(
  state: ScenarioState,
  account: MockAccount,
  raw: string,
): MockMailbox | Response {
  const wanted = normaliseAddress(raw)
  if (account.role === 'mailboxUser') {
    if (account.username.toLowerCase() !== wanted) return notFound()
    const own = state.mailboxes.find((mailbox) => addressOf(mailbox) === wanted)
    return own ?? notFound()
  }
  const mailbox = mailboxesInScope(state, account).find((item) => addressOf(item) === wanted)
  return mailbox ?? notFound()
}

/** `403 permission-flag-required` when the caller lacks the flag a change needs, else null. */
export function flagRefusal(account: MockAccount, flag: keyof PermissionFlags): Response | null {
  if (account.role === 'admin') return null
  if (account.role === 'domainAdmin' && !DOMAIN_ADMIN_FLAGS.has(flag)) return null
  if (account.permissions[flag]) return null
  return problem(403, 'permission-flag-required', { requiredFlags: [flag] })
}

/** `412` when `If-Match` is present and differs from the current tag. */
export function preconditionFailed(request: Request, etag: string): Response | null {
  const sent = request.headers.get('if-match')
  if (sent && sent !== '*' && sent !== etag) return outdated()
  return null
}

/** `503 temporary-failure` naming the unavailable dependency, when it is down. */
export function outage(state: ScenarioState, dependency: SelfServiceDependency): Response | null {
  if (!state.selfService.outages[dependency]) return null
  return problem(503, 'temporary-failure', { dependency }, { 'Retry-After': '30' })
}

/** The mailbox user's own mailbox, or `403 forbidden` for other roles. */
export function ownMailbox(state: ScenarioState, account: MockAccount): MockMailbox | Response {
  if (account.role !== 'mailboxUser') return forbidden()
  const wanted = account.username.toLowerCase()
  return state.mailboxes.find((mailbox) => addressOf(mailbox) === wanted) ?? forbidden()
}

export const isoNow = (state: ScenarioState) => new Date(state.now()).toISOString()

export const etagHeader = (etag: string) => ({ headers: { ETag: etag } })

/**
 * A JSON answer outside openapi-msw's typing, for the two schemas whose generated type carries
 * `$defs` (`MailboxOverview`, `MailboxClientConfiguration`); the validator still checks it.
 */
export function untypedJson(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return HttpResponse.json(body as Record<string, unknown>, { status, headers })
}
