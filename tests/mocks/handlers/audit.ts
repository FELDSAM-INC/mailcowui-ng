// Audit log handler (T135): `listAuditEvents` for administrators, with the contract's filters —
// `from` inclusive, `to` exclusive, repeated `eventType`, `outcome`, `actor` (username, attempted
// username or API key ID), `clientAddress` (an address or a prefix), `q`, `targetType`, `targetId`
// (UI 002 T095), paging and the order of `occurredAt` (newest first by default). A malformed
// address and a range whose start is not before its end answer 422, as the API's semantic checks
// would.
import { BlockList, isIP } from 'node:net'
import { domainToASCII } from 'node:url'

import type { AuditEvent } from '@/api'

import { http, problem, requireAccount, scenario } from './context'

/** Whether a client address equals an address or lies within a prefix. */
export function addressMatches(address: string, filter: string): boolean {
  const [base = '', prefix] = filter.split('/')
  const family = isIP(base)
  if (family === 0 || isIP(address) !== family) return false
  if (prefix === undefined) return address.toLowerCase() === base.toLowerCase()
  const list = new BlockList()
  list.addSubnet(base, Number(prefix), family === 4 ? 'ipv4' : 'ipv6')
  return list.check(address, family === 4 ? 'ipv4' : 'ipv6')
}

/** Whether a filter value is an IPv4 or IPv6 address or prefix (0–32, 0–128). */
export function isNetworkFilter(filter: string): boolean {
  const [base = '', prefix, ...rest] = filter.split('/')
  const family = isIP(base)
  if (family === 0 || rest.length > 0) return false
  if (prefix === undefined) return true
  if (!/^\d{1,3}$/.test(prefix)) return false
  return Number(prefix) <= (family === 4 ? 32 : 128)
}

function actorMatches(event: AuditEvent, actor: string): boolean {
  const wanted = actor.toLowerCase()
  return (
    event.actor.username?.toLowerCase() === wanted || event.actor.apiKeyId?.toLowerCase() === wanted
  )
}

function searchMatches(event: AuditEvent, q: string): boolean {
  const needle = q.toLowerCase()
  return [
    event.actor.username,
    event.actor.apiKeyId,
    event.clientAddress,
    event.userAgent,
    event.target?.name,
    event.requestId,
  ].some((value) => value?.toLowerCase().includes(needle))
}

/** The targets whose identifier is a domain name, matched in ASCII or Unicode form, any case. */
const DOMAIN_TARGETS = new Set(['domain', 'domainFooter', 'mtaStsPolicy'])

function asciiDomain(name: string): string {
  return (domainToASCII(name.toLowerCase()) || name).toLowerCase()
}

/**
 * The contract's `targetId`: the target identifier equals the value; domain names (targets `domain`,
 * `domainFooter` and `mtaStsPolicy`) in either form and any letter case, DKIM keys normalised or
 * by their stored spelling. Without `targetType`, a domain name
 * therefore matches the records of the domain and of its footer.
 */
export function targetMatches(
  event: AuditEvent,
  targetType: string | null,
  targetId: string | null,
): boolean {
  const target = event.target
  if (targetType && target?.type !== targetType) return false
  if (!targetId) return true
  if (!target?.id) return false
  if (DOMAIN_TARGETS.has(target.type)) return asciiDomain(target.id) === asciiDomain(targetId)
  // UI 010: DKIM keys match in the normalised form, or by an unused key's stored spelling.
  if (target.type === 'dkimKey') {
    return target.id === targetId || asciiDomain(target.id) === asciiDomain(targetId)
  }
  return target.id === targetId
}

const violation = (path: string, code: string, params: Record<string, unknown>, message: string) =>
  problem(422, 'validation-failed', { errors: { [path]: [{ code, params, message }] } })

export const auditHandlers = [
  http.get('/audit-events', ({ query, response }) => {
    const state = scenario()
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    if (account.role !== 'admin') return response.untyped(problem(403, 'forbidden'))

    const from = query.get('from')
    const to = query.get('to')
    const clientAddress = query.get('clientAddress')
    if (clientAddress && !isNetworkFilter(clientAddress)) {
      return response.untyped(
        violation(
          'clientAddress',
          'invalidFormat',
          { format: 'ipNetwork' },
          'The value is not an IP address or prefix.',
        ),
      )
    }
    if (from && to && new Date(from).getTime() >= new Date(to).getTime()) {
      return response.untyped(
        violation('to', 'outOfRange', {}, 'The end of the range must lie after its start.'),
      )
    }

    const eventTypes = query.getAll('eventType')
    const outcome = query.get('outcome')
    const actor = query.get('actor')
    const q = query.get('q')?.trim()
    const targetType = query.get('targetType')
    const targetId = query.get('targetId')
    const order = query.get('order') === 'asc' ? 1 : -1
    const limit = Number(query.get('limit') ?? 25)
    const offset = Number(query.get('offset') ?? 0)

    const matching = state.auditEvents
      .filter((event) => {
        const at = new Date(event.occurredAt).getTime()
        if (from && at < new Date(from).getTime()) return false
        if (to && at >= new Date(to).getTime()) return false
        if (eventTypes.length > 0 && !eventTypes.includes(event.eventType)) return false
        if (outcome && event.outcome !== outcome) return false
        if (actor && !actorMatches(event, actor)) return false
        if (clientAddress && !addressMatches(event.clientAddress, clientAddress)) return false
        if (q && !searchMatches(event, q)) return false
        if (!targetMatches(event, targetType, targetId)) return false
        return true
      })
      .sort((a, b) => order * (new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()))

    return response(200).json({
      data: matching.slice(offset, offset + limit),
      meta: { total: matching.length, limit, offset },
    })
  }),
]
