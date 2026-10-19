// Shared rules of the routing handlers (UI 009 research R23): access, list paging and sorting,
// `If-Match`, read-only members, the next hop grammar and the bulk action loop of API 009.
import { isIP } from 'node:net'

import type { BulkItemResult, BulkTarget } from '@/api'

import { asciiName } from '../factories/domain'
import type { MockAccount, ScenarioState } from '../scenarios/state'
import { problem, requireAccount } from './context'
import {
  addViolation,
  compareValues,
  outdated,
  validationFailed,
  type Violations,
} from './domain-rules'
import { bareVersion, bulkRequestId } from './mailbox-rules'

/** The signed-in administrator, or the problem to answer (403 forbidden for other roles). */
export function requireRoutingAdmin(state: ScenarioState): MockAccount | Response {
  const account = requireAccount(state)
  if (account instanceof Response) return account
  if (account.role !== 'admin') return problem(403, 'forbidden')
  return account
}

/** An administrator or a domain administrator; mailbox users get 403 forbidden. */
export function requireRoutingManager(state: ScenarioState): MockAccount | Response {
  const account = requireAccount(state)
  if (account instanceof Response) return account
  if (account.role === 'mailboxUser') return problem(403, 'forbidden')
  return account
}

type Flag = 'bccMaps' | 'domainRelayhost' | 'mailboxRelayhost'

/** 403 permission-flag-required naming the missing flags, or null when one of them is held. */
export function flagProblem(account: MockAccount, flags: Flag[]): Response | null {
  if (account.role === 'admin') return null
  if (flags.some((flag) => account.permissions[flag])) return null
  return problem(403, 'permission-flag-required', {
    requiredFlags: flags,
    requiredFlagsMatch: flags.length > 1 ? 'any' : 'all',
  })
}

/** The ASCII domains of an account's scope (every domain for administrators). */
export function scopeDomains(state: ScenarioState, account: MockAccount): string[] {
  if (account.role === 'admin') {
    return [...state.domains.map((domain) => domain.name), ...state.aliasDomains.map((a) => a.name)]
  }
  if (account.scope.type !== 'domains') return []
  const own = new Set(account.scope.domains)
  return [
    ...own,
    ...state.aliasDomains.filter((alias) => own.has(alias.target)).map((alias) => alias.name),
  ]
}

export interface ListQuery {
  q: string
  sort: string | null
  descending: boolean
}

export function listQuery(url: URL): ListQuery {
  return {
    q: (url.searchParams.get('q') ?? '').trim().toLowerCase(),
    sort: url.searchParams.get('sort'),
    descending: url.searchParams.get('order') === 'desc',
  }
}

/** Boolean query parameter (`true`/`false`), or undefined when absent. */
export function boolParam(url: URL, name: string): boolean | undefined {
  const value = url.searchParams.get(name)
  return value === null ? undefined : value === 'true'
}

/** Sorts by a key with ties broken by `tie` (ascending), as the API does. */
export function sortItems<T>(
  items: T[],
  value: (item: T) => unknown,
  descending: boolean,
  tie: (item: T) => number | string,
): T[] {
  const direction = descending ? -1 : 1
  return [...items].sort(
    (a, b) => direction * compareValues(value(a), value(b)) || compareValues(tie(a), tie(b)),
  )
}

/** 412 when an `If-Match` is sent and differs from the current version tag. */
export function ifMatchProblem(request: Request, etag: string): Response | null {
  const sent = request.headers.get('if-match')
  if (sent === null || sent === '*') return null
  return bareVersion(sent) === bareVersion(etag) ? null : outdated()
}

/** `immutable` for read-only members sent with another value than the current one. */
export function checkReadOnly(
  errors: Violations,
  body: Record<string, unknown>,
  current: Record<string, unknown>,
  keys: readonly string[],
): void {
  for (const key of keys) {
    if (key in body && JSON.stringify(body[key]) !== JSON.stringify(current[key])) {
      addViolation(errors, key, 'immutable')
    }
  }
}

/** `tooLong` with `max` when a trimmed value is longer than the limit. */
export function checkLength(errors: Violations, path: string, value: string, max: number): void {
  if (value.length > max) addViolation(errors, path, 'tooLong', { max })
}

const LABEL = /^[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?$/

function isHostName(name: string): boolean {
  return name.length > 0 && name.length <= 253 && name.split('.').every((part) => LABEL.test(part))
}

export interface ParsedNextHop {
  /** The stored form: a bare IP address in brackets, Unicode names in ASCII. */
  stored: string
  /** The host without brackets and port. */
  host: string
  bracketed: boolean
  port: number | null
}

/**
 * The next hop grammar of relayhosts and transports: `host`, `host:port`, `[host]` or
 * `[host]:port`; a bare IP address is stored in brackets; a bare IPv6 address has no port.
 */
export function parseNextHop(raw: string): ParsedNextHop | null {
  const value = raw.trim()
  const bare = isIP(value)
  if (bare) return { stored: `[${value}]`, host: value, bracketed: true, port: null }
  const bracket = /^\[([^\]]+)\](?::(\d{1,5}))?$/.exec(value)
  const plain = /^([^:[\]]+)(?::(\d{1,5}))?$/.exec(value)
  const match = bracket ?? plain
  if (!match) return null
  const port = match[2] === undefined ? null : Number(match[2])
  if (port !== null && (port < 1 || port > 65535)) return null
  const inner = match[1]!.replace(/^ipv6:/i, '')
  const ip = bracket ? isIP(inner) : 0
  const host = ip ? inner.toLowerCase() : asciiName(inner)
  if (!ip && !isHostName(host)) return null
  const stored = bracket
    ? `[${host}]${port === null ? '' : `:${port}`}`
    : `${host}${port === null ? '' : `:${port}`}`
  return { stored, host, bracketed: !!bracket, port }
}

/** The next hop without brackets and port, for the interference check. */
export const cleanNextHop = (nextHop: string) => parseNextHop(nextHop)?.host ?? nextHop

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/
export const isEmail = (value: string) => EMAIL.test(value)

/** The problem body of a refused bulk item. */
export async function itemProblem(answer: Response): Promise<BulkItemResult['problem']> {
  return (await answer.json()) as BulkItemResult['problem']
}

/**
 * The bulk loop of every routing collection: more targets than the bulk limit are refused as a
 * whole; a target named twice is processed once; each target is found, version-checked and
 * applied on its own.
 */
export async function runBulk<T>(
  state: ScenarioState,
  targets: BulkTarget[],
  options: {
    find: (id: string) => T | undefined
    etag: (item: T) => string
    apply: (item: T) => Promise<Response | null> | Response | null
  },
): Promise<Response | { results: BulkItemResult[] }> {
  const limit = state.routing.capabilities.bulkLimit
  if (targets.length > limit) {
    const errors: Violations = {}
    addViolation(errors, 'targets', 'tooMany', { max: limit })
    return validationFailed(errors)
  }
  const seen = new Set<string>()
  const results: BulkItemResult[] = []
  for (const target of targets) {
    if (seen.has(target.id)) continue
    seen.add(target.id)
    const item = options.find(target.id)
    if (item === undefined) {
      results.push({ id: target.id, outcome: 'notFound' })
      continue
    }
    if (
      target.version !== undefined &&
      bareVersion(target.version) !== bareVersion(options.etag(item))
    ) {
      results.push({ id: target.id, outcome: 'outdated', problem: await itemProblem(outdated()) })
      continue
    }
    const refused = await options.apply(item)
    if (refused) {
      results.push({ id: target.id, outcome: 'refused', problem: await itemProblem(refused) })
      continue
    }
    const after = options.find(target.id)
    results.push({
      id: target.id,
      outcome: 'done',
      ...(after !== undefined ? { version: options.etag(after) } : {}),
    })
  }
  return { results }
}

export function bulkBody(state: ScenarioState, results: BulkItemResult[]) {
  const count = (outcome: BulkItemResult['outcome']) =>
    results.filter((item) => item.outcome === outcome).length
  return {
    data: {
      bulkRequestId: bulkRequestId(state),
      results,
      summary: {
        total: results.length,
        done: count('done'),
        notFound: count('notFound'),
        refused: count('refused'),
        outdated: count('outdated'),
        failed: count('failed'),
      },
    },
  }
}

export const nowIso = (state: ScenarioState) => new Date(state.now()).toISOString()
