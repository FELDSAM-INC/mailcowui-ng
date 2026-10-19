// Recipient map handlers (UI 009 T096, research R23): search, the active filter and sorts;
// creation and edits with each destination trimmed, lower-cased, stripped of a leading `@`, then
// stored as `@domain` or an address; a unique original recipient; deletion and bulk actions.
import {
  mockRecipientMap,
  recipientMapEtag,
  recipientMapView,
  type MockRecipientMap,
} from '../factories/recipient-map'
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
import { asciiName } from '../factories/domain'
import {
  boolParam,
  bulkBody,
  checkReadOnly,
  ifMatchProblem,
  isEmail,
  listQuery,
  nowIso,
  requireRoutingAdmin,
  runBulk,
  sortItems,
} from './routing-rules'

/** The stored form of a destination, or null when it is neither a domain nor an address. */
export function normaliseRecipient(raw: string): string | null {
  const value = raw.trim().toLowerCase().replace(/^@/, '')
  if (value.includes('@')) {
    const at = value.lastIndexOf('@')
    const domain = asciiName(value.slice(at + 1))
    const address = `${value.slice(0, at)}@${domain}`
    return isEmail(address) && address.length <= 255 ? address : null
  }
  const domain = asciiName(value)
  return domain && isValidAsciiDomain(domain) && domain.includes('.') ? `@${domain}` : null
}

function find(state: ScenarioState, raw: string | undefined) {
  const id = Number(raw)
  return state.routing.recipientMaps.find((map) => map.id === id)
}

function check(errors: Violations, field: string, raw: string): string | null {
  if (raw.trim() === '') {
    addViolation(errors, field, 'required')
    return null
  }
  const stored = normaliseRecipient(raw)
  if (!stored) addViolation(errors, field, 'invalidFormat', { format: 'recipientMapDestination' })
  return stored
}

const SORT: Record<string, (map: MockRecipientMap) => unknown> = {
  id: (map) => map.id,
  originalDestination: (map) => map.originalDestination,
  newDestination: (map) => map.newDestination,
  active: (map) => map.active,
  createdAt: (map) => map.createdAt,
  modifiedAt: (map) => map.modifiedAt,
}

const taken = (state: ScenarioState, original: string, except?: number) =>
  state.routing.recipientMaps.find(
    (map) => map.id !== except && map.originalDestination === original,
  )

export const recipientMapHandlers = [
  http.get('/recipient-maps', ({ request, response }) => {
    const state = scenario()
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    const query = listQuery(url)
    let items = state.routing.recipientMaps.filter(
      (map) =>
        !query.q ||
        map.originalDestination.includes(query.q) ||
        map.newDestination.includes(query.q),
    )
    const active = boolParam(url, 'active')
    if (active !== undefined) items = items.filter((map) => map.active === active)
    items = sortItems(
      items,
      SORT[query.sort ?? 'id'] ?? SORT.id!,
      query.descending,
      (map) => map.id,
    )
    const result = page(items, url)
    return response(200).json({ data: result.data.map(recipientMapView), meta: result.meta })
  }),

  http.post('/recipient-maps', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const errors: Violations = {}
    const original = check(errors, 'originalDestination', body.originalDestination)
    const next = check(errors, 'newDestination', body.newDestination)
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    const existing = taken(state, original!)
    if (existing) {
      return response.untyped(
        problem(409, 'routing-entry-exists', {
          field: 'originalDestination',
          conflictingId: String(existing.id),
        }),
      )
    }
    const id = Math.max(0, ...state.routing.recipientMaps.map((map) => map.id)) + 1
    const map = mockRecipientMap({
      id,
      originalDestination: original!,
      newDestination: next!,
      active: body.active ?? true,
      createdAt: nowIso(state),
    })
    state.routing.recipientMaps.push(map)
    const data = recipientMapView(map)
    return response(201).json(
      { data },
      { headers: { Location: `/api/v2/recipient-maps/${id}`, ETag: data.etag } },
    )
  }),

  http.post('/recipient-maps/bulk-actions', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const outcome = await runBulk(state, body.targets, {
      find: (id) => find(state, id),
      etag: recipientMapEtag,
      apply: (map) => {
        if (body.action === 'delete') {
          state.routing.recipientMaps = state.routing.recipientMaps.filter(
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

  http.get('/recipient-maps/{recipientMapId}', ({ params, response }) => {
    const state = scenario()
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const map = find(state, String(params.recipientMapId))
    if (!map) return response.untyped(notFound())
    const data = recipientMapView(map)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.patch('/recipient-maps/{recipientMapId}', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const map = find(state, String(params.recipientMapId))
    if (!map) return response.untyped(notFound())
    const stale = ifMatchProblem(request, recipientMapEtag(map))
    if (stale) return response.untyped(stale)
    const body = (await request.json()) as Record<string, unknown> & {
      originalDestination?: string
      newDestination?: string
      active?: boolean
    }
    const errors: Violations = {}
    checkReadOnly(errors, body, recipientMapView(map), ['id', 'createdAt', 'modifiedAt', 'etag'])
    const original =
      body.originalDestination !== undefined
        ? check(errors, 'originalDestination', body.originalDestination)
        : map.originalDestination
    const next =
      body.newDestination !== undefined
        ? check(errors, 'newDestination', body.newDestination)
        : map.newDestination
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    const existing = taken(state, original!, map.id)
    if (existing) {
      return response.untyped(
        problem(409, 'routing-entry-exists', {
          field: 'originalDestination',
          conflictingId: String(existing.id),
        }),
      )
    }
    Object.assign(map, {
      originalDestination: original,
      newDestination: next,
      active: body.active ?? map.active,
      modifiedAt: nowIso(state),
    })
    const data = recipientMapView(map)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.delete('/recipient-maps/{recipientMapId}', ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const map = find(state, String(params.recipientMapId))
    if (!map) return response.untyped(notFound())
    const stale = ifMatchProblem(request, recipientMapEtag(map))
    if (stale) return response.untyped(stale)
    state.routing.recipientMaps = state.routing.recipientMaps.filter((item) => item.id !== map.id)
    return response(204).empty()
  }),
]
