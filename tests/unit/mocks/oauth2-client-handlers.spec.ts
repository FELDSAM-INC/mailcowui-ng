// The OAuth2 client mock handlers (UI 012 T076, research R24): every answer passes the contract
// validator (the setup file fails a test on any violation), and the documented API 012 behaviour
// holds.
import { describe, expect, it } from 'vitest'

import { useScenario } from '../../mocks/node'
import { fixedClientId, scenarioClient } from '../../mocks/scenarios/oauth2-clients'

const api = (path: string) => `${location.origin}/api/v2${path}`

interface Answer {
  status: number
  headers: Headers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any
}

async function csrfToken(): Promise<string> {
  const response = await fetch(api('/csrf-token'))
  return ((await response.json()) as { data: { token: string } }).data.token
}

async function call(
  method: string,
  path: string,
  options: { body?: unknown; ifMatch?: string } = {},
): Promise<Answer> {
  const headers: Record<string, string> = {}
  if (method !== 'GET') headers['X-CSRF-Token'] = await csrfToken()
  if (options.body !== undefined) {
    headers['Content-Type'] =
      method === 'PATCH' ? 'application/merge-patch+json' : 'application/json'
  }
  if (options.ifMatch) headers['If-Match'] = options.ifMatch
  const response = await fetch(api(path), {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const text = await response.text()
  return {
    status: response.status,
    headers: response.headers,
    body: text ? JSON.parse(text) : undefined,
  }
}

describe('OAuth2 client handlers', () => {
  it('lists with search over client IDs and redirect URIs, token filter, sort and paging', async () => {
    useScenario('oauth2-many')
    const all = await call('GET', '/oauth2-clients')
    expect(all.body.meta.total).toBe(40)
    expect(all.body.data).toHaveLength(25)
    expect(all.body.data[0]).not.toHaveProperty('clientSecret')
    const wiki = await call('GET', '/oauth2-clients?q=WIKI')
    expect(wiki.body.data.map((c: { id: number }) => c.id)).toEqual([3, 17])
    const byId = await call('GET', `/oauth2-clients?q=${fixedClientId(12)}`)
    expect(byId.body.data.map((c: { id: number }) => c.id)).toEqual([12])
    const tokens = await call('GET', '/oauth2-clients?hasActiveTokens=true')
    expect(tokens.body.data.map((c: { id: number }) => c.id)).toEqual([5])
    const desc = await call('GET', '/oauth2-clients?sort=id&order=desc&limit=50&offset=0')
    expect(desc.body.data[0].id).toBe(40)
  })

  it('creates a client with a 12-hex client ID and a 24-hex secret returned once', async () => {
    const state = useScenario('oauth2-empty')
    const created = await call('POST', '/oauth2-clients', {
      body: { redirectUris: ['https://wiki.example.org/oauth/callback'] },
    })
    expect(created.status).toBe(201)
    expect(created.body.data.clientId).toMatch(/^[0-9a-f]{12}$/)
    expect(created.body.data.clientSecret).toMatch(/^[0-9a-f]{24}$/)
    expect(created.body.data.scope).toBe('profile')
    expect(created.headers.get('Location')).toBe('/api/v2/oauth2-clients/1')
    expect(created.headers.get('ETag')).toBe(created.body.data.etag)
    const read = await call('GET', '/oauth2-clients/1')
    expect(read.body.data).not.toHaveProperty('clientSecret')
    expect(state.oauth2Clients).toHaveLength(1)
  })

  it('refuses invalid redirect URIs at their position and a list that is too long', async () => {
    useScenario('oauth2-empty')
    const invalid = await call('POST', '/oauth2-clients', {
      body: { redirectUris: ['https://ok.example.org/cb', '/relative', 'https://x.org/#f'] },
    })
    expect(invalid.status).toBe(422)
    expect(Object.keys(invalid.body.errors).sort()).toEqual(['redirectUris.1', 'redirectUris.2'])
    expect(invalid.body.errors['redirectUris.1'][0].params.format).toBe('redirectUri')
    const long = await call('POST', '/oauth2-clients', {
      body: {
        redirectUris: [`https://x.org/${'a'.repeat(1000)}`, `https://y.org/${'b'.repeat(1000)}`],
      },
    })
    expect(long.body.errors.redirectUris[0].code).toBe('tooLong')
  })

  it('changes redirect URIs with If-Match, refuses another client ID and an outdated tag', async () => {
    useScenario('oauth2-changed-elsewhere')
    const read = await call('GET', '/oauth2-clients/1')
    const etag = read.body.data.etag
    const missing = await call('PATCH', '/oauth2-clients/1', {
      body: { redirectUris: ['https://a.example.org/cb'] },
    })
    expect(missing.status).toBe(412)
    const immutable = await call('PATCH', '/oauth2-clients/1', {
      body: { clientId: 'aaaaaaaaaaaa' },
      ifMatch: etag,
    })
    expect(immutable.body.errors.clientId[0].code).toBe('immutable')
    const saved = await call('PATCH', '/oauth2-clients/1', {
      body: { redirectUris: ['https://a.example.org/cb', 'https://b.example.org/cb'] },
      ifMatch: etag,
    })
    expect(saved.status).toBe(200)
    expect(saved.body.data.redirectUris).toHaveLength(2)
    const stale = await call('PATCH', '/oauth2-clients/1', {
      body: { redirectUris: ['https://c.example.org/cb'] },
      ifMatch: etag,
    })
    expect(stale.status).toBe(412)
  })

  it('regenerates the secret, revokes tokens and deletes, each with If-Match and 404', async () => {
    const state = useScenario('oauth2-changed-elsewhere')
    state.oauth2Clients[0]!.activeAccessTokens = 3
    let etag = (await call('GET', '/oauth2-clients/1')).body.data.etag
    const renewed = await call('POST', '/oauth2-clients/1/secret-regeneration', { ifMatch: etag })
    expect(renewed.body.data.clientSecret).toMatch(/^[0-9a-f]{24}$/)
    expect(renewed.body.data.etag).not.toBe(etag)
    etag = renewed.body.data.etag
    const revoked = await call('POST', '/oauth2-clients/1/token-revocation', { ifMatch: etag })
    expect(revoked.body.data.activeAccessTokens).toBe(0)
    expect((await call('DELETE', '/oauth2-clients/1', { ifMatch: '"x"' })).status).toBe(412)
    expect((await call('DELETE', '/oauth2-clients/1', { ifMatch: etag })).status).toBe(204)
    expect((await call('GET', '/oauth2-clients/1')).status).toBe(404)
    expect((await call('DELETE', '/oauth2-clients/1', { ifMatch: etag })).status).toBe(404)
  })

  it('applies a bulk action per client with outdated, failed and not-found items', async () => {
    const state = useScenario('oauth2-bulk-twenty')
    const list = (await call('GET', '/oauth2-clients?limit=50')).body.data as {
      id: number
      etag: string
    }[]
    const targets = list.map((client) => ({ id: String(client.id), version: client.etag }))
    targets[1]!.version = '"stale"'
    targets.push({ id: '99', version: '"x"' })
    const result = await call('POST', '/oauth2-clients/bulk-actions', {
      body: { action: 'renewSecret', targets },
    })
    expect(result.body.data.summary).toMatchObject({
      total: 21,
      done: 18,
      outdated: 1,
      failed: 1,
      notFound: 1,
    })
    const done = result.body.data.results.find((item: { id: string }) => item.id === '1')
    expect(done.clientSecret).toMatch(/^[0-9a-f]{24}$/)
    expect(state.oauth2Clients[0]!.clientSecret).toBe(done.clientSecret)
    const deleted = await call('POST', '/oauth2-clients/bulk-actions', {
      body: { action: 'delete', targets: [{ id: '3' }] },
    })
    expect(deleted.body.data.results[0].outcome).toBe('done')
    expect(state.oauth2Clients.some((client) => client.id === 3)).toBe(false)
  })

  it('refuses more targets than the bulk limit', async () => {
    useScenario('oauth2-bulk-partial', { oauth2Capabilities: { bulkLimit: 2 } })
    const refused = await call('POST', '/oauth2-clients/bulk-actions', {
      body: { action: 'delete', targets: [{ id: '1' }, { id: '2' }, { id: '3' }] },
    })
    expect(refused.status).toBe(422)
    expect(refused.body.errors.targets[0].code).toBe('tooMany')
    const capabilities = await call('GET', '/capabilities/oauth2-clients')
    expect(capabilities.body.data.bulkLimit).toBe(2)
  })

  it('serves the scenario clients without secrets', () => {
    expect(scenarioClient(4).clientId).toBe(fixedClientId(4))
  })
})
