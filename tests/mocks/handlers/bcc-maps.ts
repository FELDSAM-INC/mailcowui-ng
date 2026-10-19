// BCC map handlers (UI 009 T079, research R23): the scope (every map for administrators, orphaned
// ones included; the domains and alias domains of a domain administrator, never orphaned ones),
// search, filters and sorts; creation, edits and deletion with the `bccMaps` flag checked first;
// bulk actions with type switches that may duplicate a map; and the local destination choices,
// generated on demand so that a scenario can offer 10,000 of them.
import type { BccDestinationChoice, BccMapType } from '@/api'

import {
  bccMapEtag,
  bccMapView,
  domainOfDestination,
  mockBccMap,
  type MockBccMap,
} from '../factories/bcc-map'
import { asciiName } from '../factories/domain'
import type { MockAccount, ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem, scenario } from './context'
import { addViolation, notFound, page, validationFailed, type Violations } from './domain-rules'
import {
  boolParam,
  bulkBody,
  checkLength,
  checkReadOnly,
  flagProblem,
  ifMatchProblem,
  isEmail,
  listQuery,
  nowIso,
  requireRoutingManager,
  runBulk,
  scopeDomains,
  sortItems,
} from './routing-rules'

const isOrphaned = (state: ScenarioState, map: MockBccMap) =>
  !state.domains.some((domain) => domain.name === map.domain) &&
  !state.aliasDomains.some((alias) => alias.name === map.domain)

function visible(state: ScenarioState, account: MockAccount): MockBccMap[] {
  if (account.role === 'admin') return state.routing.bccMaps
  const scope = new Set(scopeDomains(state, account))
  return state.routing.bccMaps.filter((map) => scope.has(map.domain) && !isOrphaned(state, map))
}

const view = (state: ScenarioState, map: MockBccMap) => bccMapView(map, isOrphaned(state, map))

function find(state: ScenarioState, account: MockAccount, raw: string | undefined) {
  const id = Number(raw)
  return visible(state, account).find((map) => map.id === id)
}

/** Every local destination choice of a scope, in a stable order. */
export function bccChoices(state: ScenarioState, account: MockAccount): BccDestinationChoice[] {
  const scope = scopeDomains(state, account)
  const domains = state.domains.filter((domain) => scope.includes(domain.name))
  const aliasDomains = state.aliasDomains.filter((alias) => scope.includes(alias.name))
  const mailboxes = state.mailboxes.filter((mailbox) => scope.includes(mailbox.domain))
  const choices: BccDestinationChoice[] = [
    ...domains.map((domain) => ({
      kind: 'domain' as const,
      value: `@${domain.name}`,
      domain: domain.name,
      deliversTo: [],
    })),
    ...aliasDomains.map((alias) => ({
      kind: 'aliasDomain' as const,
      value: `@${alias.name}`,
      domain: alias.name,
      deliversTo: [],
    })),
    ...mailboxes.map((mailbox) => ({
      kind: 'mailbox' as const,
      value: `${mailbox.localPart}@${mailbox.domain}`,
      domain: mailbox.domain,
      deliversTo: [],
    })),
    ...state.routing.aliases
      .filter((alias) => scope.includes(domainOfDestination(alias.address)))
      .map((alias) => ({
        kind: 'alias' as const,
        value: alias.address,
        domain: domainOfDestination(alias.address),
        deliversTo: alias.deliversTo.filter((target) =>
          scope.includes(domainOfDestination(target)),
        ),
      })),
    ...aliasDomains.flatMap((alias) =>
      mailboxes
        .filter((mailbox) => mailbox.domain === alias.target)
        .map((mailbox) => ({
          kind: 'aliasDomainAddress' as const,
          value: `${mailbox.localPart}@${alias.name}`,
          domain: alias.name,
          deliversTo: [`${mailbox.localPart}@${mailbox.domain}`],
        })),
    ),
  ]
  for (const domain of domains) {
    for (let index = 1; index <= state.routing.bccChoiceExtra; index += 1) {
      choices.push({
        kind: 'mailbox',
        value: `user${String(index).padStart(5, '0')}@${domain.name}`,
        domain: domain.name,
        deliversTo: [],
      })
    }
  }
  return choices
}

function duplicate(
  state: ScenarioState,
  localDestination: string,
  type: BccMapType,
  except?: number,
) {
  return state.routing.bccMaps.find(
    (map) => map.id !== except && map.localDestination === localDestination && map.type === type,
  )
}

function checkBccDestination(errors: Violations, state: ScenarioState, value: string) {
  if (value === '') addViolation(errors, 'bccDestination', 'required')
  else if (/[\s,;]/.test(value)) addViolation(errors, 'bccDestination', 'tooMany', { max: 1 })
  else if (!isEmail(value))
    addViolation(errors, 'bccDestination', 'invalidFormat', { format: 'email' })
  checkLength(
    errors,
    'bccDestination',
    value,
    state.routing.capabilities.bccMaps.bccDestinationMaxLength,
  )
}

const SORT: Record<string, (map: MockBccMap) => unknown> = {
  id: (map) => map.id,
  type: (map) => map.type,
  localDestination: (map) => map.localDestination,
  bccDestination: (map) => map.bccDestination,
  domain: (map) => map.domain,
  active: (map) => map.active,
  createdAt: (map) => map.createdAt,
  modifiedAt: (map) => map.modifiedAt,
}

export const bccMapHandlers = [
  http.get('/bcc-maps', ({ request, response }) => {
    const state = scenario()
    const account = requireRoutingManager(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    const query = listQuery(url)
    let items = visible(state, account).filter(
      (map) =>
        !query.q ||
        map.localDestination.toLowerCase().includes(query.q) ||
        map.bccDestination.toLowerCase().includes(query.q),
    )
    const type = url.searchParams.get('type')
    if (type) items = items.filter((map) => map.type === type)
    const active = boolParam(url, 'active')
    if (active !== undefined) items = items.filter((map) => map.active === active)
    const domains = url.searchParams.getAll('domain').map((name) => asciiName(name) || name)
    if (domains.length > 0) items = items.filter((map) => domains.includes(map.domain))
    const orphaned = boolParam(url, 'orphaned')
    if (orphaned !== undefined && account.role === 'admin') {
      items = items.filter((map) => isOrphaned(state, map) === orphaned)
    }
    const value = SORT[query.sort ?? 'id'] ?? SORT.id!
    items = sortItems(items, value, query.descending, (map) => map.id)
    const result = page(items, url)
    return response(200).json({
      data: result.data.map((map) => view(state, map)),
      meta: result.meta,
    })
  }),

  http.post('/bcc-maps', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingManager(state)
    if (account instanceof Response) return response.untyped(account)
    const missing = flagProblem(account, ['bccMaps'])
    if (missing) return response.untyped(missing)
    const body = await request.json()
    const errors: Violations = {}
    const raw = body.localDestination.trim().toLowerCase()
    const wanted = raw.includes('@') ? raw : `@${raw}`
    const choice = bccChoices(state, account).find((item) => item.value === wanted)
    if (raw === '') addViolation(errors, 'localDestination', 'required')
    else if (!choice) addViolation(errors, 'localDestination', 'notFound')
    const bccDestination = body.bccDestination.trim()
    checkBccDestination(errors, state, bccDestination)
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    const existing = duplicate(state, choice!.value, body.type)
    if (existing) {
      return response.untyped(
        problem(409, 'routing-entry-exists', {
          field: 'localDestination',
          conflictingId: String(existing.id),
        }),
      )
    }
    const id = Math.max(0, ...state.routing.bccMaps.map((map) => map.id)) + 1
    const map = mockBccMap({
      id,
      type: body.type,
      localDestination: choice!.value,
      bccDestination,
      domain: choice!.domain,
      active: body.active ?? true,
      createdAt: nowIso(state),
    })
    state.routing.bccMaps.push(map)
    const data = view(state, map)
    return response(201).json(
      { data },
      { headers: { Location: `/api/v2/bcc-maps/${id}`, ETag: data.etag } },
    )
  }),

  http.get('/bcc-destination-choices', ({ request, response }) => {
    const state = scenario()
    const account = requireRoutingManager(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    const query = listQuery(url)
    const kinds = url.searchParams.getAll('kind')
    const domains = url.searchParams.getAll('domain').map((name) => asciiName(name) || name)
    let items = bccChoices(state, account).filter(
      (item) =>
        (!query.q || item.value.includes(query.q)) &&
        (kinds.length === 0 || kinds.includes(item.kind)) &&
        (domains.length === 0 || domains.includes(item.domain)),
    )
    if (query.sort === 'value')
      items = sortItems(
        items,
        (item) => item.value,
        query.descending,
        () => 0,
      )
    const result = page(items, url)
    return response(200).json({ data: result.data, meta: result.meta })
  }),

  http.post('/bcc-maps/bulk-actions', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingManager(state)
    if (account instanceof Response) return response.untyped(account)
    const missing = flagProblem(account, ['bccMaps'])
    if (missing) return response.untyped(missing)
    const body = await request.json()
    const outcome = await runBulk(state, body.targets, {
      find: (id) => find(state, account, id),
      etag: bccMapEtag,
      apply: (map) => {
        if (body.action === 'delete') {
          state.routing.bccMaps = state.routing.bccMaps.filter((item) => item.id !== map.id)
          return null
        }
        if (body.action === 'switchToSender' || body.action === 'switchToRecipient') {
          const type: BccMapType = body.action === 'switchToSender' ? 'sender' : 'recipient'
          if (map.type === type) return null
          const existing = duplicate(state, map.localDestination, type, map.id)
          if (existing) {
            return problem(409, 'routing-entry-exists', {
              field: 'type',
              conflictingId: String(existing.id),
            })
          }
          map.type = type
        } else map.active = body.action === 'activate'
        map.modifiedAt = nowIso(state)
        return null
      },
    })
    if (outcome instanceof Response) return response.untyped(outcome)
    return response(200).json(bulkBody(state, outcome.results))
  }),

  http.get('/bcc-maps/{bccMapId}', ({ params, response }) => {
    const state = scenario()
    const account = requireRoutingManager(state)
    if (account instanceof Response) return response.untyped(account)
    const map = find(state, account, String(params.bccMapId))
    if (!map) return response.untyped(notFound())
    const data = view(state, map)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.patch('/bcc-maps/{bccMapId}', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingManager(state)
    if (account instanceof Response) return response.untyped(account)
    const missing = flagProblem(account, ['bccMaps'])
    if (missing) return response.untyped(missing)
    const map = find(state, account, String(params.bccMapId))
    if (!map) return response.untyped(notFound())
    const stale = ifMatchProblem(request, bccMapEtag(map))
    if (stale) return response.untyped(stale)
    const body = (await request.json()) as Record<string, unknown> & {
      type?: BccMapType
      bccDestination?: string
      active?: boolean
    }
    const errors: Violations = {}
    checkReadOnly(errors, body, view(state, map), [
      'id',
      'localDestination',
      'domain',
      'orphaned',
      'createdAt',
      'modifiedAt',
      'etag',
    ])
    const bccDestination = body.bccDestination?.trim()
    if (bccDestination !== undefined) checkBccDestination(errors, state, bccDestination)
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    const type = body.type ?? map.type
    const existing = duplicate(state, map.localDestination, type, map.id)
    if (existing) {
      return response.untyped(
        problem(409, 'routing-entry-exists', { field: 'type', conflictingId: String(existing.id) }),
      )
    }
    Object.assign(map, {
      type,
      bccDestination: bccDestination ?? map.bccDestination,
      active: body.active ?? map.active,
      modifiedAt: nowIso(state),
    })
    const data = view(state, map)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.delete('/bcc-maps/{bccMapId}', ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingManager(state)
    if (account instanceof Response) return response.untyped(account)
    const missing = flagProblem(account, ['bccMaps'])
    if (missing) return response.untyped(missing)
    const map = find(state, account, String(params.bccMapId))
    if (!map) return response.untyped(notFound())
    const stale = ifMatchProblem(request, bccMapEtag(map))
    if (stale) return response.untyped(stale)
    state.routing.bccMaps = state.routing.bccMaps.filter((item) => item.id !== map.id)
    return response(204).empty()
  }),
]
