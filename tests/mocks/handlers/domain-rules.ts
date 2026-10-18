// Shared rules of the domain and template handlers (UI 002 research D28): access checks, name
// normalisation, field violations and the value rules of API 002 with their codes and parameters.
import type { FieldViolation } from '@/api'

import { asciiName } from '../factories/domain'
import type { MockAccount, MockDomain, ScenarioState } from '../scenarios/state'
import { problem, requireAccount } from './context'

export const MIB = 1_048_576

/** The signed-in administrator or domain administrator, or the problem to answer. */
export function requireManager(state: ScenarioState): MockAccount | Response {
  const account = requireAccount(state)
  if (account instanceof Response) return account
  if (account.role === 'mailboxUser') return problem(403, 'forbidden')
  return account
}

/** The signed-in administrator, or the problem to answer. */
export function requireAdmin(state: ScenarioState): MockAccount | Response {
  const account = requireAccount(state)
  if (account instanceof Response) return account
  if (account.role !== 'admin') return problem(403, 'forbidden')
  return account
}

/** The domains an account may see. */
export function scopeOf(state: ScenarioState, account: MockAccount): MockDomain[] {
  if (account.role === 'admin') return state.domains
  if (account.scope.type !== 'domains') return []
  const names = new Set(account.scope.domains)
  return state.domains.filter((domain) => names.has(domain.name))
}

/** A domain of the account's scope by any spelling of its name, or undefined. */
export function findInScope(
  state: ScenarioState,
  account: MockAccount,
  raw: string,
): MockDomain | undefined {
  const name = asciiName(raw)
  return name ? scopeOf(state, account).find((domain) => domain.name === name) : undefined
}

export const notFound = () => problem(404, null)
export const outdated = () => problem(412, null)

export type Violations = Record<string, FieldViolation[]>

export function violation(
  code: FieldViolation['code'],
  params: Record<string, unknown> = {},
): FieldViolation {
  return { code, params, message: `Rule ${String(code)} failed.` }
}

export function addViolation(
  errors: Violations,
  path: string,
  code: FieldViolation['code'],
  params: Record<string, unknown> = {},
) {
  ;(errors[path] ??= []).push(violation(code, params))
}

export function validationFailed(errors: Violations): Response {
  return problem(422, 'validation-failed', { errors })
}

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

/** FR-020: dot-separated labels of letters, digits and inner hyphens, at most 253 characters. */
export function isValidAsciiDomain(name: string): boolean {
  return (
    name.length > 0 && name.length <= 253 && name.split('.').every((label) => LABEL.test(label))
  )
}

/** A failure injected for one domain and operation (research D28), consumed when `times` is set. */
export function domainFailure(
  state: ScenarioState,
  name: string,
  operationId: string,
): Response | null {
  const failure = state.domainFailures[name]
  if (!failure) return null
  if (failure.operations && !failure.operations.includes(operationId)) return null
  if (failure.times !== undefined) {
    if (failure.times <= 0) return null
    failure.times -= 1
  }
  const headers: Record<string, string> =
    failure.status === 503 ? { 'Retry-After': String(failure.retryAfter ?? 30) } : {}
  return problem(failure.status, failure.type ?? null, {}, headers)
}

export interface QuotaValues {
  maxMailboxQuota: number
  domainQuota: number
}

const QUOTA_KEYS = ['maxMailboxQuota', 'domainQuota'] as const

/** Quotas are whole MiB, and the maximum mailbox quota ≤ the domain quota. */
export function checkQuotas(
  errors: Violations,
  values: QuotaValues,
  sent: Partial<QuotaValues>,
): void {
  for (const key of QUOTA_KEYS) {
    if (sent[key] !== undefined && sent[key] % MIB !== 0) {
      addViolation(errors, key, 'notMultipleOf', { factor: MIB })
    }
  }
  if (values.maxMailboxQuota > values.domainQuota) {
    addViolation(errors, 'maxMailboxQuota', 'mustNotExceed', {
      field: 'domainQuota',
      value: values.domainQuota,
    })
  }
}

/** Relay normalisation: relayUnknownOnly implies relayAllRecipients, which implies backupMx. */
export function normaliseRelay<
  T extends { backupMx: boolean; relayAllRecipients: boolean; relayUnknownOnly: boolean },
>(values: T): T {
  const relayAllRecipients = values.relayAllRecipients || values.relayUnknownOnly
  return { ...values, relayAllRecipients, backupMx: values.backupMx || relayAllRecipients }
}

/** Tags compared as sets ignoring letter case. */
export function sameTags(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a.map((tag) => tag.trim().toLowerCase()).filter(Boolean))
  const right = new Set(b.map((tag) => tag.trim().toLowerCase()).filter(Boolean))
  return left.size === right.size && [...left].every((tag) => right.has(tag))
}

/** The page of a list, with the query's `limit` and `offset`. */
export function page<T>(
  items: T[],
  url: URL,
): { data: T[]; meta: { total: number; limit: number; offset: number } } {
  const limit = Number(url.searchParams.get('limit') ?? 25)
  const offset = Number(url.searchParams.get('offset') ?? 0)
  return { data: items.slice(offset, offset + limit), meta: { total: items.length, limit, offset } }
}

/** Compares two values of a sort key; null sorts first. */
export function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return -1
  if (b === null || b === undefined) return 1
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b, 'en', { sensitivity: 'base' }) || (a < b ? -1 : a > b ? 1 : 0)
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return (a as number) - (b as number)
}

/** UTF-8 size of a text. */
export const utf8Bytes = (text: string) => Buffer.byteLength(text, 'utf8')
