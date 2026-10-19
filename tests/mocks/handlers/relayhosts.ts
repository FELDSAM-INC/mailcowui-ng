// Relayhost handlers (UI 009 T026, T067; research R23): the list with search, filters, sorts and
// paging; creation and merge-patch edits with write-only credentials (an omitted password is kept,
// `""` removes it, an empty username removes it too, a password without a username is refused);
// deletion and bulk deletion clear the domain and mailbox assignments; the usage list; the choices
// of the relayhost selectors; and the scripted connection test.
import type { RoutingConnectionTestResult } from '@/api'

import { connectionTestResult } from '../factories/connection-test'
import {
  mockRelayhost,
  relayhostEtag,
  relayhostView,
  type MockRelayhost,
} from '../factories/relayhost'
import type { ScenarioState } from '../scenarios/state'
import { csrfProblem, http, scenario } from './context'
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
  parseNextHop,
  requireRoutingAdmin,
  requireRoutingManager,
  runBulk,
  sortItems,
} from './routing-rules'

const addressOf = (mailbox: { localPart: string; domain: string }) =>
  `${mailbox.localPart}@${mailbox.domain}`

export function relayhostUsage(state: ScenarioState, id: number) {
  return {
    domains: state.domains.filter((domain) => domain.relayhost?.id === id).length,
    mailboxes: state.mailboxes.filter((mailbox) => mailbox.relayhostId === id).length,
  }
}

const view = (state: ScenarioState, relayhost: MockRelayhost) =>
  relayhostView(relayhost, relayhostUsage(state, relayhost.id))

/** Keeps the domains' stored relayhost in step with a relayhost's host (UI 002's representation). */
export function syncRelayhostHost(state: ScenarioState, relayhost: MockRelayhost): void {
  for (const domain of state.domains) {
    if (domain.relayhost?.id === relayhost.id)
      domain.relayhost = { id: relayhost.id, hostname: relayhost.host }
  }
}

/** Removes a relayhost and clears its domain and mailbox assignments (API FR-021). */
export function removeRelayhost(state: ScenarioState, id: number): void {
  state.routing.relayhosts = state.routing.relayhosts.filter((item) => item.id !== id)
  const now = new Date(state.now()).toISOString()
  for (const domain of state.domains) {
    if (domain.relayhost?.id === id) {
      domain.relayhost = null
      domain.modifiedAt = now
    }
  }
  for (const mailbox of state.mailboxes) {
    if (mailbox.relayhostId === id) {
      mailbox.relayhostId = null
      mailbox.modifiedAt = now
    }
  }
}

const SORT: Record<string, (state: ScenarioState, item: MockRelayhost) => unknown> = {
  id: (_s, item) => item.id,
  host: (_s, item) => item.host,
  username: (_s, item) => item.username,
  active: (_s, item) => item.active,
  domainCount: (s, item) => relayhostUsage(s, item.id).domains,
  mailboxCount: (s, item) => relayhostUsage(s, item.id).mailboxes,
}

function checkCredentials(
  errors: Violations,
  state: ScenarioState,
  username: string,
  password: string,
): void {
  const limits = state.routing.capabilities.administration!.maxLengths
  if (username.includes(':'))
    addViolation(errors, 'username', 'invalidCharacter', { characters: ':' })
  checkLength(errors, 'username', username, limits.username)
  checkLength(errors, 'password', password, limits.password)
  if (password !== '' && username === '') {
    addViolation(errors, 'username', 'required', { because: 'password' })
  }
}

function findRelayhost(state: ScenarioState, raw: string | undefined) {
  const id = Number(raw)
  return Number.isInteger(id) ? state.routing.relayhosts.find((item) => item.id === id) : undefined
}

/** Runs a scripted connection test (shared with the transport handler). */
export async function runConnectionTest(
  state: ScenarioState,
  request: Request,
  key: string,
  nextHop: string,
): Promise<Response | { data: RoutingConnectionTestResult }> {
  const body = (await request.json().catch(() => ({}))) as { sender?: string; recipient?: string }
  const defaults = state.routing.capabilities.administration!.connectionTest
  const errors: Violations = {}
  for (const field of ['sender', 'recipient'] as const) {
    const value = body[field]?.trim()
    if (value !== undefined && value !== '' && !isEmail(value)) {
      addViolation(errors, field, 'invalidFormat', { format: 'email' })
    }
  }
  if (Object.keys(errors).length > 0) return validationFailed(errors)
  const script = state.routing.tests[key]
  if (script && 'never' in script) {
    await new Promise<never>((_resolve, reject) => {
      request.signal.addEventListener('abort', () => reject(new Error('aborted')))
    })
  }
  if (script && 'delayMs' in script && script.delayMs) {
    await new Promise((resolve) => setTimeout(resolve, script.delayMs))
  }
  const partial = script && 'result' in script ? script.result : {}
  return {
    data: connectionTestResult(
      nextHop,
      partial,
      {
        sender: body.sender?.trim() || defaults.defaultSender,
        recipient: body.recipient?.trim() || defaults.defaultRecipient,
      },
      state.now(),
    ),
  }
}

export const relayhostHandlers = [
  http.get('/relayhosts', ({ request, response }) => {
    const state = scenario()
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    const query = listQuery(url)
    let items = state.routing.relayhosts.filter(
      (item) =>
        !query.q ||
        item.host.toLowerCase().includes(query.q) ||
        (item.username ?? '').toLowerCase().includes(query.q),
    )
    const active = boolParam(url, 'active')
    if (active !== undefined) items = items.filter((item) => item.active === active)
    const inUse = boolParam(url, 'inUse')
    if (inUse !== undefined) {
      items = items.filter((item) => {
        const usage = relayhostUsage(state, item.id)
        return usage.domains + usage.mailboxes > 0 === inUse
      })
    }
    const value = SORT[query.sort ?? 'id'] ?? SORT.id!
    items = sortItems(
      items,
      (item) => value(state, item),
      query.descending,
      (item) => item.id,
    )
    const result = page(items, url)
    return response(200).json({
      data: result.data.map((item) => view(state, item)),
      meta: result.meta,
    })
  }),

  http.post('/relayhosts', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const errors: Violations = {}
    const parsed = parseNextHop(body.host)
    if (body.host.trim() === '') addViolation(errors, 'host', 'required')
    else if (!parsed) addViolation(errors, 'host', 'invalidFormat', { format: 'nextHop' })
    checkLength(
      errors,
      'host',
      body.host.trim(),
      state.routing.capabilities.administration!.maxLengths.host,
    )
    const username = (body.username ?? '').trim()
    const password = ((body.password as unknown as string | undefined) ?? '').trim()
    checkCredentials(errors, state, username, password)
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    const id = Math.max(0, ...state.routing.relayhosts.map((item) => item.id)) + 1
    const relayhost = mockRelayhost({
      id,
      host: parsed!.stored,
      username: username || null,
      password: password || null,
      active: body.active ?? true,
    })
    state.routing.relayhosts.push(relayhost)
    const data = view(state, relayhost)
    return response(201).json(
      { data },
      { headers: { Location: `/api/v2/relayhosts/${id}`, ETag: data.etag } },
    )
  }),

  http.get('/relayhost-choices', ({ request, response }) => {
    const state = scenario()
    const account = requireRoutingManager(state)
    if (account instanceof Response) return response.untyped(account)
    const missing = flagProblem(account, ['domainRelayhost', 'mailboxRelayhost'])
    if (missing) return response.untyped(missing)
    const url = new URL(request.url)
    const query = listQuery(url)
    let items = state.routing.relayhosts.filter(
      (item) => !query.q || item.host.toLowerCase().includes(query.q),
    )
    const sort =
      query.sort === 'host' ? (item: MockRelayhost) => item.host : (item: MockRelayhost) => item.id
    items = sortItems(items, sort, query.descending, (item) => item.id)
    const result = page(items, url)
    return response(200).json({
      data: result.data.map((item) => ({
        id: item.id,
        host: item.host,
        username: item.username,
        active: item.active,
      })),
      meta: result.meta,
    })
  }),

  http.post('/relayhosts/bulk-actions', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const outcome = await runBulk(state, body.targets, {
      find: (id) => findRelayhost(state, id),
      etag: relayhostEtag,
      apply: (item) => {
        if (body.action === 'delete') removeRelayhost(state, item.id)
        else item.active = body.action === 'activate'
        return null
      },
    })
    if (outcome instanceof Response) return response.untyped(outcome)
    return response(200).json(bulkBody(state, outcome.results))
  }),

  http.get('/relayhosts/{relayhostId}', ({ params, response }) => {
    const state = scenario()
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const relayhost = findRelayhost(state, String(params.relayhostId))
    if (!relayhost) return response.untyped(notFound())
    const data = view(state, relayhost)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.patch('/relayhosts/{relayhostId}', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const relayhost = findRelayhost(state, String(params.relayhostId))
    if (!relayhost) return response.untyped(notFound())
    const stale = ifMatchProblem(request, relayhostEtag(relayhost))
    if (stale) return response.untyped(stale)
    const body = (await request.json()) as Record<string, unknown> & {
      host?: string
      username?: string
      password?: string
      active?: boolean
    }
    const errors: Violations = {}
    const current = view(state, relayhost) as unknown as Record<string, unknown>
    checkReadOnly(errors, body, current, ['id', 'usage', 'passwordSet', 'etag'])
    let host = relayhost.host
    if (body.host !== undefined) {
      const parsed = parseNextHop(body.host)
      if (body.host.trim() === '') addViolation(errors, 'host', 'required')
      else if (!parsed) addViolation(errors, 'host', 'invalidFormat', { format: 'nextHop' })
      else host = parsed.stored
    }
    const username = body.username !== undefined ? body.username.trim() : (relayhost.username ?? '')
    let password = relayhost.password ?? ''
    if (body.password !== undefined) password = body.password.trim()
    else if (body.username !== undefined && username === '') password = ''
    if (body.password !== undefined || body.username !== undefined) {
      checkCredentials(errors, state, username, body.password !== undefined ? password : '')
    }
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    Object.assign(relayhost, {
      host,
      username: username || null,
      password: password || null,
      active: body.active ?? relayhost.active,
    })
    syncRelayhostHost(state, relayhost)
    const data = view(state, relayhost)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.delete('/relayhosts/{relayhostId}', ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const relayhost = findRelayhost(state, String(params.relayhostId))
    if (!relayhost) return response.untyped(notFound())
    const stale = ifMatchProblem(request, relayhostEtag(relayhost))
    if (stale) return response.untyped(stale)
    removeRelayhost(state, relayhost.id)
    return response(204).empty()
  }),

  http.get('/relayhosts/{relayhostId}/usage', ({ params, request, response }) => {
    const state = scenario()
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const relayhost = findRelayhost(state, String(params.relayhostId))
    if (!relayhost) return response.untyped(notFound())
    const url = new URL(request.url)
    const query = listQuery(url)
    const kind = url.searchParams.get('kind')
    let items = [
      ...state.domains
        .filter((domain) => domain.relayhost?.id === relayhost.id)
        .map((domain) => ({ kind: 'domain' as const, name: domain.name })),
      ...state.mailboxes
        .filter((mailbox) => mailbox.relayhostId === relayhost.id)
        .map((mailbox) => ({ kind: 'mailbox' as const, name: addressOf(mailbox) })),
    ].filter((item) => (!kind || item.kind === kind) && (!query.q || item.name.includes(query.q)))
    const byName = query.sort === 'name'
    items = sortItems(
      items,
      (item) => (byName ? item.name : item.kind),
      query.descending,
      (item) => (byName ? item.kind : item.name),
    )
    const result = page(items, url)
    return response(200).json({ data: result.data, meta: result.meta })
  }),

  http.post('/relayhosts/{relayhostId}/connection-test', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const relayhost = findRelayhost(state, String(params.relayhostId))
    if (!relayhost) return response.untyped(notFound())
    const result = await runConnectionTest(
      state,
      request,
      `relayhost:${relayhost.id}`,
      relayhost.host,
    )
    if (result instanceof Response) return response.untyped(result)
    return response(200).json(result)
  }),
]
