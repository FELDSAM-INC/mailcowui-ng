// Forwarding host handlers (UI 009 T102, research R23): search on address and source, the spam
// filter and exact source filters, sorts (addresses IPv4 before IPv6, numerically); creation of an
// address or prefix in canonical form, or of a name resolved from the scenario's DNS table, with
// `added` and `updated` entries (`201` with a `Location` of the source filter when one was added,
// otherwise `200`), `422 notResolvable` and `503 temporary-failure`; reads, spam filter edits and
// deletions by the percent-encoded address; and bulk actions.
import { isIP } from 'node:net'

import type { ForwardingHostCreationResult } from '@/api'

import {
  forwardingHostEtag,
  forwardingHostView,
  type MockForwardingHost,
} from '../factories/forwarding-host'
import type { ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem, scenario } from './context'
import { addViolation, notFound, page, validationFailed, type Violations } from './domain-rules'
import {
  boolParam,
  bulkBody,
  checkLength,
  checkReadOnly,
  ifMatchProblem,
  listQuery,
  requireRoutingAdmin,
  runBulk,
  sortItems,
} from './routing-rules'

function ipv6Groups(address: string): number[] | null {
  const [head, tail] = address.toLowerCase().split('::') as [string, string | undefined]
  const part = (text: string) => (text ? text.split(':').map((group) => parseInt(group, 16)) : [])
  const left = part(head)
  const right = tail === undefined ? [] : part(tail)
  const missing = 8 - left.length - right.length
  if (tail === undefined ? left.length !== 8 : missing < 0) return null
  return [...left, ...Array<number>(Math.max(missing, 0)).fill(0), ...right]
}

function compressIpv6(groups: number[]): string {
  const hex = groups.map((group) => group.toString(16))
  let bestStart = -1
  let bestLength = 0
  for (let start = 0; start < 8; start += 1) {
    let length = 0
    while (start + length < 8 && groups[start + length] === 0) length += 1
    if (length > bestLength && length > 1) {
      bestStart = start
      bestLength = length
    }
  }
  if (bestStart < 0) return hex.join(':')
  return `${hex.slice(0, bestStart).join(':')}::${hex.slice(bestStart + bestLength).join(':')}`
}

/** The canonical form of an address or prefix (host bits cleared), or null. */
export function canonicalAddress(raw: string): string | null {
  const [address, prefixText] = raw.trim().split('/') as [string, string | undefined]
  const family = isIP(address)
  if (!family) return null
  const max = family === 4 ? 32 : 128
  const prefix = prefixText === undefined ? null : Number(prefixText)
  if (prefix !== null && (!Number.isInteger(prefix) || prefix < 0 || prefix > max)) return null
  if (family === 4) {
    const octets = address.split('.').map(Number)
    let value = octets.reduce((sum, octet) => sum * 256 + octet, 0)
    if (prefix !== null) value = prefix === 0 ? 0 : value - (value % 2 ** (32 - prefix))
    const text = [24, 16, 8, 0].map((shift) => Math.floor(value / 2 ** shift) % 256).join('.')
    return prefix === null ? text : `${text}/${prefix}`
  }
  const groups = ipv6Groups(address)
  if (!groups) return null
  if (prefix !== null) {
    for (let index = 0; index < 8; index += 1) {
      const keep = Math.max(0, Math.min(16, prefix - index * 16))
      groups[index] = keep === 0 ? 0 : groups[index]! & (0xffff << (16 - keep)) & 0xffff
    }
  }
  const text = compressIpv6(groups)
  return prefix === null ? text : `${text}/${prefix}`
}

function sortKey(address: string): string {
  const canonical = canonicalAddress(address) ?? address
  const [ip] = canonical.split('/') as [string]
  if (isIP(ip) === 4)
    return `a${ip
      .split('.')
      .map((octet) => octet.padStart(3, '0'))
      .join('')}`
  const groups = ipv6Groups(ip) ?? []
  return `b${groups.map((group) => group.toString(16).padStart(4, '0')).join('')}`
}

const SORT: Record<string, (host: MockForwardingHost) => unknown> = {
  address: (host) => sortKey(host.address),
  source: (host) => host.source,
  spamFilter: (host) => host.spamFilter,
}

function find(state: ScenarioState, raw: string): MockForwardingHost | undefined {
  const address = decodeURIComponent(raw)
  return state.routing.forwardingHosts.find((host) => host.address === address)
}

const sameAddress = (a: string, b: string) =>
  (canonicalAddress(a) ?? a) === (canonicalAddress(b) ?? b)

export const forwardingHostHandlers = [
  http.get('/forwarding-hosts', ({ request, response }) => {
    const state = scenario()
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    const query = listQuery(url)
    let items = state.routing.forwardingHosts.filter(
      (host) =>
        !query.q ||
        host.address.toLowerCase().includes(query.q) ||
        host.source.toLowerCase().includes(query.q),
    )
    const spamFilter = boolParam(url, 'spamFilter')
    if (spamFilter !== undefined) items = items.filter((host) => host.spamFilter === spamFilter)
    const source = url.searchParams.get('source')
    if (source !== null) items = items.filter((host) => host.source === source)
    items = sortItems(
      items,
      SORT[query.sort ?? 'address'] ?? SORT.address!,
      query.descending,
      (host) => sortKey(host.address),
    )
    const result = page(items, url)
    return response(200).json({ data: result.data.map(forwardingHostView), meta: result.meta })
  }),

  http.post('/forwarding-hosts', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const source = body.host.trim()
    const errors: Violations = {}
    if (source === '') addViolation(errors, 'host', 'required')
    checkLength(
      errors,
      'host',
      source,
      state.routing.capabilities.administration!.maxLengths.forwardingHost,
    )
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    let addresses: string[]
    const canonical = canonicalAddress(source)
    if (canonical) addresses = [canonical]
    else if (source.includes('/') || /^[\d.:]+$/.test(source)) {
      addViolation(errors, 'host', 'invalidFormat', { format: 'ipNetwork' })
      return response.untyped(validationFailed(errors))
    } else {
      const answer = state.routing.dns[source.toLowerCase()]
      if (answer === 'temporaryFailure') {
        return response.untyped(
          problem(503, 'temporary-failure', { dependency: 'dns' }, { 'Retry-After': '5' }),
        )
      }
      if (!answer || answer === 'none') {
        addViolation(errors, 'host', 'notResolvable')
        return response.untyped(validationFailed(errors))
      }
      addresses = answer.map((address) => canonicalAddress(address) ?? address)
    }
    const spamFilter = body.spamFilter ?? true
    const entries: ForwardingHostCreationResult['entries'] = []
    for (const address of addresses.sort((a, b) => sortKey(a).localeCompare(sortKey(b)))) {
      const existing = state.routing.forwardingHosts.find((host) =>
        sameAddress(host.address, address),
      )
      if (existing) {
        existing.source = source
        existing.spamFilter = spamFilter
        entries.push({ outcome: 'updated', forwardingHost: forwardingHostView(existing) })
      } else {
        const host = { address, source, spamFilter }
        state.routing.forwardingHosts.push(host)
        entries.push({ outcome: 'added', forwardingHost: forwardingHostView(host) })
      }
    }
    const data = { source, entries }
    if (entries.some((entry) => entry.outcome === 'added')) {
      return response(201).json(
        { data },
        { headers: { Location: `/api/v2/forwarding-hosts?source=${encodeURIComponent(source)}` } },
      )
    }
    return response(200).json({ data })
  }),

  http.post('/forwarding-hosts/bulk-actions', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const outcome = await runBulk(state, body.targets, {
      find: (id) => state.routing.forwardingHosts.find((host) => host.address === id),
      etag: forwardingHostEtag,
      apply: (host) => {
        if (body.action === 'delete') {
          state.routing.forwardingHosts = state.routing.forwardingHosts.filter(
            (item) => item !== host,
          )
        } else host.spamFilter = body.action === 'enableSpamFilter'
        return null
      },
    })
    if (outcome instanceof Response) return response.untyped(outcome)
    return response(200).json(bulkBody(state, outcome.results))
  }),

  http.get('/forwarding-hosts/{forwardingHostAddress}', ({ params, response }) => {
    const state = scenario()
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const host = find(state, String(params.forwardingHostAddress))
    if (!host) return response.untyped(notFound())
    const data = forwardingHostView(host)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.patch('/forwarding-hosts/{forwardingHostAddress}', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const host = find(state, String(params.forwardingHostAddress))
    if (!host) return response.untyped(notFound())
    const stale = ifMatchProblem(request, forwardingHostEtag(host))
    if (stale) return response.untyped(stale)
    const body = (await request.json()) as Record<string, unknown> & { spamFilter?: boolean }
    const errors: Violations = {}
    checkReadOnly(errors, body, forwardingHostView(host), [
      'address',
      'source',
      'etag',
    ])
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    if (body.spamFilter !== undefined) host.spamFilter = body.spamFilter
    const data = forwardingHostView(host)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.delete('/forwarding-hosts/{forwardingHostAddress}', ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const host = find(state, String(params.forwardingHostAddress))
    if (!host) return response.untyped(notFound())
    const stale = ifMatchProblem(request, forwardingHostEtag(host))
    if (stale) return response.untyped(stale)
    state.routing.forwardingHosts = state.routing.forwardingHosts.filter((item) => item !== host)
    return response(204).empty()
  }),
]
