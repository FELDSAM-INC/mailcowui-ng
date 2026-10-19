// TLS policy map handlers (UI 009 T089, research R23): search on destination and parameters,
// repeated `policy`, the active filter and sorts; creation and edits with the destination
// lower-cased and in ASCII (`.`, `*`, `@` and a port without brackets refused), the policy in any
// case stored lower-case, parameters as `name=value` items; a unique destination; deletion and
// bulk actions.
import type { TlsPolicy } from '@/api'

import { asciiName } from '../factories/domain'
import {
  mockTlsPolicyMap,
  tlsPolicyMapEtag,
  tlsPolicyMapView,
  type MockTlsPolicyMap,
} from '../factories/tls-policy-map'
import type { ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem, scenario } from './context'
import {
  addViolation,
  isValidAsciiDomain,
  notFound,
  page,
  validationFailed,
  type Violations,
} from './domain-rules'
import {
  boolParam,
  bulkBody,
  checkLength,
  checkReadOnly,
  ifMatchProblem,
  listQuery,
  nowIso,
  requireRoutingAdmin,
  runBulk,
  sortItems,
} from './routing-rules'

export function normaliseTlsDestination(raw: string): string | null {
  const value = raw.trim().toLowerCase()
  const bracket = /^\[([^\]]+)\](?::(\d{1,5}))?$/.exec(value)
  if (bracket) {
    const host = asciiName(bracket[1]!)
    return host && isValidAsciiDomain(host)
      ? `[${host}]${bracket[2] ? `:${bracket[2]}` : ''}`
      : null
  }
  if (value === '.' || value.includes('*') || value.includes('@') || value.includes(':'))
    return null
  const dotted = value.startsWith('.')
  const host = asciiName(dotted ? value.slice(1) : value)
  return host && isValidAsciiDomain(host) ? `${dotted ? '.' : ''}${host}` : null
}

export function normaliseParameters(raw: string): string | null {
  const items = raw.trim().split(/\s+/).filter(Boolean)
  if (items.every((item) => /^[^=\s]+=[^=\s]+$/.test(item))) return items.join(' ')
  return null
}

function find(state: ScenarioState, raw: string | undefined) {
  const id = Number(raw)
  return state.routing.tlsPolicyMaps.find((map) => map.id === id)
}

function checkValues(
  errors: Violations,
  state: ScenarioState,
  values: { destination?: string; policy?: string; parameters?: string },
) {
  const limits = state.routing.capabilities.administration!.maxLengths
  const allowed = state.routing.capabilities.administration!.tlsPolicies
  const out: { destination?: string; policy?: TlsPolicy; parameters?: string } = {}
  if (values.destination !== undefined) {
    const stored = normaliseTlsDestination(values.destination)
    if (values.destination.trim() === '') addViolation(errors, 'destination', 'required')
    else if (!stored)
      addViolation(errors, 'destination', 'invalidFormat', { format: 'tlsPolicyDestination' })
    else out.destination = stored
    checkLength(errors, 'destination', values.destination.trim(), limits.tlsPolicyDestination)
  }
  if (values.policy !== undefined) {
    const policy = values.policy.trim().toLowerCase() as TlsPolicy
    if (!allowed.includes(policy)) addViolation(errors, 'policy', 'notInList', { allowed })
    else out.policy = policy
  }
  if (values.parameters !== undefined) {
    const stored = normaliseParameters(values.parameters)
    if (stored === null)
      addViolation(errors, 'parameters', 'invalidFormat', { format: 'tlsPolicyParameters' })
    else out.parameters = stored
    checkLength(errors, 'parameters', values.parameters.trim(), limits.tlsPolicyParameters)
  }
  return out
}

const SORT: Record<string, (map: MockTlsPolicyMap) => unknown> = {
  id: (map) => map.id,
  destination: (map) => map.destination,
  policy: (map) => map.policy,
  active: (map) => map.active,
  createdAt: (map) => map.createdAt,
  modifiedAt: (map) => map.modifiedAt,
}

const taken = (state: ScenarioState, destination: string, except?: number) =>
  state.routing.tlsPolicyMaps.find((map) => map.id !== except && map.destination === destination)

export const tlsPolicyMapHandlers = [
  http.get('/tls-policy-maps', ({ request, response }) => {
    const state = scenario()
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    const query = listQuery(url)
    let items = state.routing.tlsPolicyMaps.filter(
      (map) =>
        !query.q ||
        map.destination.includes(query.q) ||
        map.parameters.toLowerCase().includes(query.q),
    )
    const policies = url.searchParams.getAll('policy')
    if (policies.length > 0) items = items.filter((map) => policies.includes(map.policy))
    const active = boolParam(url, 'active')
    if (active !== undefined) items = items.filter((map) => map.active === active)
    items = sortItems(
      items,
      SORT[query.sort ?? 'id'] ?? SORT.id!,
      query.descending,
      (map) => map.id,
    )
    const result = page(items, url)
    return response(200).json({ data: result.data.map(tlsPolicyMapView), meta: result.meta })
  }),

  http.post('/tls-policy-maps', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const errors: Violations = {}
    const values = checkValues(errors, state, {
      destination: body.destination,
      policy: body.policy,
      parameters: body.parameters ?? '',
    })
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    const existing = taken(state, values.destination!)
    if (existing) {
      return response.untyped(
        problem(409, 'routing-entry-exists', {
          field: 'destination',
          conflictingId: String(existing.id),
        }),
      )
    }
    const id = Math.max(0, ...state.routing.tlsPolicyMaps.map((map) => map.id)) + 1
    const map = mockTlsPolicyMap({
      id,
      destination: values.destination!,
      policy: values.policy!,
      parameters: values.parameters ?? '',
      active: body.active ?? true,
      createdAt: nowIso(state),
    })
    state.routing.tlsPolicyMaps.push(map)
    const data = tlsPolicyMapView(map)
    return response(201).json(
      { data },
      { headers: { Location: `/api/v2/tls-policy-maps/${id}`, ETag: data.etag } },
    )
  }),

  http.post('/tls-policy-maps/bulk-actions', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const outcome = await runBulk(state, body.targets, {
      find: (id) => find(state, id),
      etag: tlsPolicyMapEtag,
      apply: (map) => {
        if (body.action === 'delete') {
          state.routing.tlsPolicyMaps = state.routing.tlsPolicyMaps.filter(
            (item) => item.id !== map.id,
          )
        } else {
          map.active = body.action === 'activate'
          map.modifiedAt = nowIso(state)
        }
        return null
      },
    })
    if (outcome instanceof Response) return response.untyped(outcome)
    return response(200).json(bulkBody(state, outcome.results))
  }),

  http.get('/tls-policy-maps/{tlsPolicyMapId}', ({ params, response }) => {
    const state = scenario()
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const map = find(state, String(params.tlsPolicyMapId))
    if (!map) return response.untyped(notFound())
    const data = tlsPolicyMapView(map)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.patch('/tls-policy-maps/{tlsPolicyMapId}', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const map = find(state, String(params.tlsPolicyMapId))
    if (!map) return response.untyped(notFound())
    const stale = ifMatchProblem(request, tlsPolicyMapEtag(map))
    if (stale) return response.untyped(stale)
    const body = (await request.json()) as Record<string, unknown> & {
      destination?: string
      policy?: string
      parameters?: string
      active?: boolean
    }
    const errors: Violations = {}
    checkReadOnly(errors, body, tlsPolicyMapView(map), [
      'id',
      'createdAt',
      'modifiedAt',
      'etag',
    ])
    const values = checkValues(errors, state, body)
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    const existing = values.destination ? taken(state, values.destination, map.id) : undefined
    if (existing) {
      return response.untyped(
        problem(409, 'routing-entry-exists', {
          field: 'destination',
          conflictingId: String(existing.id),
        }),
      )
    }
    Object.assign(map, values, { active: body.active ?? map.active, modifiedAt: nowIso(state) })
    const data = tlsPolicyMapView(map)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.delete('/tls-policy-maps/{tlsPolicyMapId}', ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const map = find(state, String(params.tlsPolicyMapId))
    if (!map) return response.untyped(notFound())
    const stale = ifMatchProblem(request, tlsPolicyMapEtag(map))
    if (stale) return response.untyped(stale)
    state.routing.tlsPolicyMaps = state.routing.tlsPolicyMaps.filter((item) => item.id !== map.id)
    return response(204).empty()
  }),
]
