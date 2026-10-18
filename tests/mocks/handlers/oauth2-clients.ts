// OAuth2 client handlers (UI 012 US5 T076, research R24): the capabilities; the list with search,
// token filter, sort and paging; creation with a generated client ID and a secret returned once;
// the client read and its merge-patch change of the redirect URIs (`immutable` client ID and
// scope); deletion, secret regeneration and token revocation, each with If-Match, 412 and 404; and
// the bulk action (`delete`, `revokeTokens`, `renewSecret` with each new secret once) of up to
// `bulkLimit` targets, each checked against its version tag.
import type { FieldViolation, Oauth2ClientBulkItemResult } from '@/api'

import {
  mockOauth2Client,
  newClientId,
  newClientSecret,
  oauth2ClientEtag,
  oauth2ClientView,
  type MockOauth2Client,
} from '../factories/oauth2-client'
import type { ScenarioState } from '../scenarios/state'
import { csrfProblem, http, scenario } from './context'
import {
  addViolation,
  compareValues,
  notFound,
  outdated,
  page,
  requireAdmin,
  validationFailed,
  type Violations,
} from './domain-rules'

const SORT_VALUE: Record<string, (client: MockOauth2Client) => unknown> = {
  id: (client) => client.id,
  clientId: (client) => client.clientId,
  redirectUri: (client) => client.redirectUris.join(' '),
}

const find = (state: ScenarioState, id: number) =>
  state.oauth2Clients.find((client) => client.id === id)

/** Absolute URI with a scheme, without a fragment and without whitespace (format `redirectUri`). */
export function isRedirectUri(value: string): boolean {
  if (value === '' || /\s/.test(value) || value.includes('#')) return false
  return /^[A-Za-z][A-Za-z0-9+.-]*:\S+$/.test(value)
}

/** The rules of a creation or a change of the redirect URIs; returns the list to store. */
function checkRedirectUris(
  state: ScenarioState,
  errors: Violations,
  uris: string[] | undefined,
): string[] {
  if (!uris || uris.length === 0) {
    addViolation(errors, 'redirectUris', 'required')
    return []
  }
  uris.forEach((uri, index) => {
    if (!isRedirectUri(uri)) {
      addViolation(errors, `redirectUris.${index}`, 'invalidFormat', { format: 'redirectUri' })
    }
  })
  const unique = [...new Set(uris)]
  const max = state.oauth2Capabilities.redirectUrisMaxLength
  if (unique.join(' ').length > max) addViolation(errors, 'redirectUris', 'tooLong', { max })
  return unique
}

/** 412 when If-Match is missing or no longer matches. */
function preconditionFailed(request: Request, client: MockOauth2Client): Response | null {
  const ifMatch = request.headers.get('if-match')
  if (!ifMatch || ifMatch.replace(/^W\//, '') !== oauth2ClientEtag(client)) return outdated()
  return null
}

/** A bulk target's version, with or without the quotes (BulkTarget). */
const sameVersion = (version: string | undefined, client: MockOauth2Client) =>
  version === undefined ||
  version === oauth2ClientEtag(client) ||
  `"${version}"` === oauth2ClientEtag(client)

const itemProblem = (status: number, title: string) => ({
  type: 'about:blank',
  title,
  status,
  requestId: '0'.repeat(32),
})

/** A guarded write: CSRF, administrator, the client and its If-Match. */
async function guardedWrite(
  request: Request,
  id: string | number,
  write: (state: ScenarioState, client: MockOauth2Client) => Response | Promise<Response>,
): Promise<Response> {
  const state = scenario()
  const refused = csrfProblem(state, request)
  if (refused) return refused
  const account = requireAdmin(state)
  if (account instanceof Response) return account
  const client = find(state, Number(id))
  if (!client) return notFound()
  const stale = preconditionFailed(request, client)
  if (stale) return stale
  return write(state, client)
}

const withSecret = (client: MockOauth2Client) => ({
  ...oauth2ClientView(client),
  clientSecret: client.clientSecret,
})

export const oauth2ClientHandlers = [
  http.get('/capabilities/oauth2-clients', ({ response }) => {
    const state = scenario()
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    return response(200).json({ data: state.oauth2Capabilities })
  }),

  http.get('/oauth2-clients', ({ request, response }) => {
    const state = scenario()
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    let items = [...state.oauth2Clients]
    const q = url.searchParams.get('q')?.toLowerCase()
    if (q) {
      items = items.filter(
        (client) =>
          client.clientId.toLowerCase().includes(q) ||
          client.redirectUris.some((uri) => uri.toLowerCase().includes(q)),
      )
    }
    const tokens = url.searchParams.get('hasActiveTokens')
    if (tokens === 'true' || tokens === 'false') {
      const wanted = tokens === 'true'
      items = items.filter(
        (client) => client.activeAccessTokens + client.activeRefreshTokens > 0 === wanted,
      )
    }
    const value = SORT_VALUE[url.searchParams.get('sort') ?? 'id'] ?? SORT_VALUE.id!
    const direction = url.searchParams.get('order') === 'desc' ? -1 : 1
    items.sort((a, b) => direction * compareValues(value(a), value(b)) || a.id - b.id)
    const result = page(items, url)
    return response(200).json({ data: result.data.map(oauth2ClientView), meta: result.meta })
  }),

  http.post('/oauth2-clients', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const errors: Violations = {}
    const uris = checkRedirectUris(state, errors, body.redirectUris)
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    const id = Math.max(0, ...state.oauth2Clients.map((client) => client.id)) + 1
    let clientId = newClientId()
    while (state.oauth2Clients.some((client) => client.clientId === clientId)) {
      clientId = newClientId()
    }
    const client = mockOauth2Client({ id, clientId, redirectUris: uris, scope: 'profile' })
    state.oauth2Clients.push(client)
    const data = withSecret(client)
    return response(201).json(
      { data },
      { headers: { Location: `/api/v2/oauth2-clients/${id}`, ETag: data.etag } },
    )
  }),

  http.post('/oauth2-clients/bulk-actions', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const limit = state.oauth2Capabilities.bulkLimit
    if (body.targets.length > limit) {
      const tooMany = {
        code: 'tooMany',
        message: 'Too many targets.',
        params: { max: limit },
      } as FieldViolation
      return response.untyped(validationFailed({ targets: [tooMany] }))
    }
    const seen = new Set<string>()
    const results: Oauth2ClientBulkItemResult[] = []
    for (const target of body.targets) {
      if (seen.has(target.id)) continue
      seen.add(target.id)
      const client = find(state, Number(target.id))
      if (!client) {
        results.push({ id: target.id, outcome: 'notFound', problem: itemProblem(404, 'Not found') })
      } else if (client.failsInBulk) {
        results.push({ id: target.id, outcome: 'failed', problem: itemProblem(500, 'Error') })
      } else if (!sameVersion(target.version, client)) {
        results.push({
          id: target.id,
          outcome: 'outdated',
          problem: itemProblem(412, 'Precondition failed'),
        })
      } else if (body.action === 'delete') {
        state.oauth2Clients = state.oauth2Clients.filter((item) => item.id !== client.id)
        results.push({ id: target.id, outcome: 'done' })
      } else if (body.action === 'revokeTokens') {
        client.activeAccessTokens = 0
        client.activeRefreshTokens = 0
        results.push({ id: target.id, outcome: 'done', version: oauth2ClientEtag(client) })
      } else {
        client.clientSecret = newClientSecret()
        client.version += 1
        results.push({
          id: target.id,
          outcome: 'done',
          version: oauth2ClientEtag(client),
          clientSecret: client.clientSecret,
        })
      }
    }
    const count = (outcome: Oauth2ClientBulkItemResult['outcome']) =>
      results.filter((item) => item.outcome === outcome).length
    return response(200).json({
      data: {
        bulkRequestId: '1'.repeat(32),
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
    })
  }),

  http.get('/oauth2-clients/{oauth2ClientId}', ({ params, response }) => {
    const state = scenario()
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const client = find(state, Number(params.oauth2ClientId))
    if (!client) return response.untyped(notFound())
    const data = oauth2ClientView(client)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.patch('/oauth2-clients/{oauth2ClientId}', async ({ params, request, response }) =>
    response.untyped(
      await guardedWrite(request, params.oauth2ClientId, async (state, client) => {
        const body = await request.json()
        const errors: Violations = {}
        if (body.clientId !== undefined && body.clientId !== client.clientId) {
          addViolation(errors, 'clientId', 'immutable')
        }
        if (body.scope !== undefined && body.scope !== client.scope) {
          addViolation(errors, 'scope', 'immutable')
        }
        let uris = client.redirectUris
        if (body.redirectUris !== undefined) {
          uris = checkRedirectUris(state, errors, body.redirectUris)
        }
        if (Object.keys(errors).length > 0) return validationFailed(errors)
        if (uris.join(' ') !== client.redirectUris.join(' ')) {
          client.redirectUris = uris
          client.version += 1
        }
        const data = oauth2ClientView(client)
        return Response.json({ data }, { headers: { ETag: data.etag } })
      }),
    ),
  ),

  http.delete('/oauth2-clients/{oauth2ClientId}', async ({ params, request, response }) =>
    response.untyped(
      await guardedWrite(request, params.oauth2ClientId, (state, client) => {
        state.oauth2Clients = state.oauth2Clients.filter((item) => item.id !== client.id)
        return new Response(null, { status: 204 })
      }),
    ),
  ),

  http.post(
    '/oauth2-clients/{oauth2ClientId}/secret-regeneration',
    async ({ params, request, response }) =>
      response.untyped(
        await guardedWrite(request, params.oauth2ClientId, (_state, client) => {
          client.clientSecret = newClientSecret()
          client.version += 1
          const data = withSecret(client)
          return Response.json({ data }, { headers: { ETag: data.etag } })
        }),
      ),
  ),

  http.post(
    '/oauth2-clients/{oauth2ClientId}/token-revocation',
    async ({ params, request, response }) =>
      response.untyped(
        await guardedWrite(request, params.oauth2ClientId, (_state, client) => {
          client.activeAccessTokens = 0
          client.activeRefreshTokens = 0
          const data = oauth2ClientView(client)
          return Response.json({ data }, { headers: { ETag: data.etag } })
        }),
      ),
  ),
]
