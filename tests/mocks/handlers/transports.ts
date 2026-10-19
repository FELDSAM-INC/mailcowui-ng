// Transport handlers (UI 009 T053, T067; research R23): the list with search, filters (the next hop
// exact without regard to letter case), sorts and `nextHopSharedWith`; creation of one destination
// with the shared credential rules of `TransportCreateRequest` (inherit, refuse a different username
// with `next-hop-credentials-differ`, a password replaces the next hop's password everywhere), the
// three conflict types and `meta.affectedTransports`; merge-patch edits with `TransportPatch`'s
// credential rules; deletion; bulk actions; and the scripted connection test.
import {
  mockTransport,
  sameNextHop,
  transportEtag,
  transportReference,
  transportView,
  type MockTransport,
} from '../factories/transport'
import type { ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem, scenario } from './context'
import { addViolation, notFound, page, validationFailed, type Violations } from './domain-rules'
import { runConnectionTest } from './relayhosts'
import {
  boolParam,
  bulkBody,
  checkLength,
  checkReadOnly,
  ifMatchProblem,
  isEmail,
  listQuery,
  parseNextHop,
  requireRoutingAdmin,
  runBulk,
  sortItems,
} from './routing-rules'

const DOMAIN =
  /^\.?([a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?\.)*[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?$/

function find(state: ScenarioState, raw: string | undefined): MockTransport | undefined {
  const id = Number(raw)
  return Number.isInteger(id) ? state.routing.transports.find((item) => item.id === id) : undefined
}

const view = (state: ScenarioState, transport: MockTransport) =>
  transportView(transport, state.routing.transports)

/** Normalises a destination, or returns the violation's rule. */
function checkDestination(
  value: string,
  mxBased: boolean,
): { stored: string } | { code: 'invalidFormat' | 'invalidRegex' } {
  if (mxBased) {
    try {
      new RegExp(value)
      return { stored: value }
    } catch {
      return { code: 'invalidRegex' }
    }
  }
  const lower = value.toLowerCase()
  if (lower === '*' || isEmail(lower) || DOMAIN.test(lower)) return { stored: lower }
  return { code: 'invalidFormat' }
}

/** `next-hop-interferes`: `host` and `[host]…` would both be next hops. */
function interference(state: ScenarioState, nextHop: string, exceptId?: number): MockTransport[] {
  const parsed = parseNextHop(nextHop)
  if (!parsed) return []
  return state.routing.transports.filter((other) => {
    if (other.id === exceptId || sameNextHop(other.nextHop, nextHop)) return false
    const otherParsed = parseNextHop(other.nextHop)
    if (!otherParsed) return false
    return otherParsed.host === parsed.host && otherParsed.bracketed !== parsed.bracketed
  })
}

function interferesProblem(others: MockTransport[]) {
  return problem(409, 'next-hop-interferes', {
    nextHop: others[0]!.nextHop,
    transportIds: others.map((item) => item.id),
  })
}

/** Writes the credentials of a next hop to each of its transports; returns the other ones changed. */
function applyCredentials(
  state: ScenarioState,
  nextHop: string,
  username: string | null,
  password: string | null,
  exceptId: number,
): MockTransport[] {
  const changed: MockTransport[] = []
  for (const other of state.routing.transports) {
    if (other.id === exceptId || !sameNextHop(other.nextHop, nextHop)) continue
    if (other.username !== username || other.password !== password) {
      other.username = username
      other.password = password
      changed.push(other)
    }
  }
  return changed
}

const SORT: Record<string, (item: MockTransport) => unknown> = {
  id: (item) => item.id,
  destination: (item) => item.destination,
  nextHop: (item) => item.nextHop,
  username: (item) => item.username,
  active: (item) => item.active,
  mxBased: (item) => item.mxBased,
}

export const transportHandlers = [
  http.get('/transports', ({ request, response }) => {
    const state = scenario()
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    const query = listQuery(url)
    let items = state.routing.transports.filter(
      (item) =>
        !query.q ||
        [item.destination, item.nextHop, item.username ?? ''].some((value) =>
          value.toLowerCase().includes(query.q),
        ),
    )
    const active = boolParam(url, 'active')
    if (active !== undefined) items = items.filter((item) => item.active === active)
    const mxBased = boolParam(url, 'mxBased')
    if (mxBased !== undefined) items = items.filter((item) => item.mxBased === mxBased)
    const nextHop = url.searchParams.get('nextHop')
    if (nextHop) {
      // G35: the filter is normalised like a stored next hop.
      const wanted = parseNextHop(nextHop)?.stored ?? nextHop.trim()
      items = items.filter((item) => sameNextHop(item.nextHop, wanted))
    }
    const value = SORT[query.sort ?? 'id'] ?? SORT.id!
    items = sortItems(items, value, query.descending, (item) => item.id)
    const result = page(items, url)
    return response(200).json({
      data: result.data.map((item) => view(state, item)),
      meta: result.meta,
    })
  }),

  http.post('/transports', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const limits = state.routing.capabilities.administration!.maxLengths
    const errors: Violations = {}
    const mxBased = body.mxBased ?? false
    const destinationRaw = body.destination.trim()
    const destination = checkDestination(destinationRaw, mxBased)
    if (destinationRaw === '') addViolation(errors, 'destination', 'required')
    else if ('code' in destination) {
      addViolation(
        errors,
        'destination',
        destination.code,
        destination.code === 'invalidFormat' ? { format: 'transportDestination' } : {},
      )
    }
    checkLength(errors, 'destination', destinationRaw, limits.transportDestination)
    const parsed = parseNextHop(body.nextHop)
    if (body.nextHop.trim() === '') addViolation(errors, 'nextHop', 'required')
    else if (!parsed) addViolation(errors, 'nextHop', 'invalidFormat', { format: 'nextHop' })
    const username = (body.username ?? '').trim()
    const password = ((body.password as unknown as string | undefined) ?? '').trim()
    if (username.includes(':'))
      addViolation(errors, 'username', 'invalidCharacter', { characters: ':' })
    checkLength(errors, 'username', username, limits.username)
    checkLength(errors, 'password', password, limits.password)
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    const nextHop = parsed!.stored
    const stored = (destination as { stored: string }).stored
    const existing = state.routing.transports.find(
      (item) => item.destination.toLowerCase() === stored.toLowerCase(),
    )
    if (existing) {
      return response.untyped(
        problem(409, 'routing-entry-exists', {
          field: 'destination',
          conflictingId: String(existing.id),
        }),
      )
    }
    const interfering = interference(state, nextHop)
    if (interfering.length > 0) return response.untyped(interferesProblem(interfering))
    const shared = state.routing.transports.filter((item) => sameNextHop(item.nextHop, nextHop))
    let finalUsername: string | null = username || null
    let finalPassword: string | null = password || null
    if (shared.length > 0) {
      const sharedUsername = shared[0]!.username
      if (username === '' && password === '') {
        finalUsername = sharedUsername
        finalPassword = shared[0]!.password
      } else if (username !== '' && username !== (sharedUsername ?? '')) {
        return response.untyped(
          problem(409, 'next-hop-credentials-differ', {
            nextHop: shared[0]!.nextHop,
            transportIds: shared.map((item) => item.id),
          }),
        )
      } else {
        finalUsername = sharedUsername
        finalPassword = password || shared[0]!.password
      }
    }
    const id = Math.max(0, ...state.routing.transports.map((item) => item.id)) + 1
    const transport = mockTransport({
      id,
      destination: stored,
      nextHop,
      mxBased,
      username: finalUsername,
      password: finalPassword,
      active: body.active ?? false,
    })
    state.routing.transports.push(transport)
    const affected = applyCredentials(state, nextHop, finalUsername, finalPassword, id)
    const data = view(state, transport)
    return response(201).json(
      { data, meta: { affectedTransports: affected.map(transportReference) } },
      { headers: { Location: `/api/v2/transports/${id}`, ETag: data.etag } },
    )
  }),

  http.post('/transports/bulk-actions', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const outcome = await runBulk(state, body.targets, {
      find: (id) => find(state, id),
      etag: transportEtag,
      apply: (item) => {
        if (body.action === 'delete') {
          state.routing.transports = state.routing.transports.filter(
            (other) => other.id !== item.id,
          )
        } else item.active = body.action === 'activate'
        return null
      },
    })
    if (outcome instanceof Response) return response.untyped(outcome)
    return response(200).json(bulkBody(state, outcome.results))
  }),

  http.get('/transports/{transportId}', ({ params, response }) => {
    const state = scenario()
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const transport = find(state, String(params.transportId))
    if (!transport) return response.untyped(notFound())
    const data = view(state, transport)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.patch('/transports/{transportId}', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const transport = find(state, String(params.transportId))
    if (!transport) return response.untyped(notFound())
    const stale = ifMatchProblem(request, transportEtag(transport))
    if (stale) return response.untyped(stale)
    const body = (await request.json()) as Record<string, unknown> & {
      destination?: string
      nextHop?: string
      mxBased?: boolean
      active?: boolean
      username?: string
      password?: string
    }
    const errors: Violations = {}
    checkReadOnly(errors, body, view(state, transport), [
      'id',
      'nextHopSharedWith',
      'passwordSet',
      'etag',
    ])
    const mxBased = body.mxBased ?? transport.mxBased
    let destination = transport.destination
    if (body.destination !== undefined || body.mxBased !== undefined) {
      const raw = (body.destination ?? transport.destination).trim()
      const checked = checkDestination(raw, mxBased)
      if (raw === '') addViolation(errors, 'destination', 'required')
      else if ('code' in checked) {
        addViolation(
          errors,
          'destination',
          checked.code,
          checked.code === 'invalidFormat' ? { format: 'transportDestination' } : {},
        )
      } else destination = checked.stored
    }
    let nextHop = transport.nextHop
    if (body.nextHop !== undefined) {
      const parsed = parseNextHop(body.nextHop)
      if (body.nextHop.trim() === '') addViolation(errors, 'nextHop', 'required')
      else if (!parsed) addViolation(errors, 'nextHop', 'invalidFormat', { format: 'nextHop' })
      else nextHop = parsed.stored
    }
    if (body.username?.includes(':')) {
      addViolation(errors, 'username', 'invalidCharacter', { characters: ':' })
    }
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    const duplicate = state.routing.transports.find(
      (item) =>
        item.id !== transport.id && item.destination.toLowerCase() === destination.toLowerCase(),
    )
    if (duplicate) {
      return response.untyped(
        problem(409, 'routing-entry-exists', {
          field: 'destination',
          conflictingId: String(duplicate.id),
        }),
      )
    }
    const interfering = interference(state, nextHop, transport.id)
    if (interfering.length > 0) return response.untyped(interferesProblem(interfering))
    const moved = !sameNextHop(nextHop, transport.nextHop)
    const others = state.routing.transports.filter(
      (item) => item.id !== transport.id && sameNextHop(item.nextHop, nextHop),
    )
    let username = transport.username
    let password = transport.password
    const credentialsSent = body.username !== undefined || body.password !== undefined
    if (credentialsSent) {
      if (body.username !== undefined) username = body.username.trim() || null
      if (body.password !== undefined) password = body.password.trim() || null
      else if (body.username !== undefined && !username) password = null
    } else if (moved && others.length > 0) {
      username = others[0]!.username
      password = others[0]!.password
    }
    Object.assign(transport, {
      destination,
      nextHop,
      mxBased,
      active: body.active ?? transport.active,
      username,
      password,
    })
    const affected = credentialsSent
      ? applyCredentials(state, nextHop, username, password, transport.id)
      : []
    const data = view(state, transport)
    return response(200).json(
      { data, meta: { affectedTransports: affected.map(transportReference) } },
      { headers: { ETag: data.etag } },
    )
  }),

  http.delete('/transports/{transportId}', ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const transport = find(state, String(params.transportId))
    if (!transport) return response.untyped(notFound())
    const stale = ifMatchProblem(request, transportEtag(transport))
    if (stale) return response.untyped(stale)
    state.routing.transports = state.routing.transports.filter((item) => item.id !== transport.id)
    return response(204).empty()
  }),

  http.post('/transports/{transportId}/connection-test', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const transport = find(state, String(params.transportId))
    if (!transport) return response.untyped(notFound())
    const result = await runConnectionTest(
      state,
      request,
      `transport:${transport.id}`,
      transport.nextHop,
    )
    if (result instanceof Response) return response.untyped(result)
    return response(200).json(result)
  }),
]
