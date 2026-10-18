// The US7 mock handlers (T123): filters, sorting, paging, validation codes, the secret, revocation
// and the owner candidates.
import { describe, expect, it } from 'vitest'

import { mockState, useScenario } from '../../mocks/node'
import { ELSEWHERE_KEY, fixedKeyId } from '../../mocks/scenarios/api-keys'

const api = (path: string) => `${location.origin}/api/v2${path}`

async function csrf(): Promise<string> {
  const body = (await (await fetch(api('/csrf-token'))).json()) as { data: { token: string } }
  return body.data.token
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- free-form JSON in assertions
type Json = Record<string, any>

async function call(method: string, path: string, body?: unknown, headers: HeadersInit = {}) {
  const response = await fetch(api(path), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(method === 'GET' ? {} : { 'X-CSRF-Token': await csrf() }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  return { response, body: (text ? JSON.parse(text) : null) as Json }
}

describe('listApiKeys', () => {
  it('pages newest first with the total', async () => {
    useScenario('api-keys-many')
    const { body } = await call('GET', '/api-keys?limit=25&offset=25')
    expect(body.meta).toEqual({ total: 60, limit: 25, offset: 25 })
    expect(body.data).toHaveLength(25)
    expect(body.data[0].name).toBe('Billing 35')
  })

  it('filters by status, access level and owner, and sorts by name', async () => {
    useScenario('api-keys-many')
    const revoked = await call('GET', '/api-keys?status=revoked&limit=100')
    expect(revoked.body.data.every((k: Json) => k.status === 'revoked')).toBe(true)
    expect(revoked.body.meta.total).toBe(12)
    const owned = await call('GET', '/api-keys?ownerUsername=former')
    expect(owned.body.data.map((k: Json) => k.owner)).toEqual([
      { username: 'former', role: 'domainAdmin', active: false },
    ])
    const deleted = await call('GET', '/api-keys?ownerUsername=olduser')
    expect(deleted.body.data[0].owner).toEqual({ username: 'olduser', role: null, active: false })
    const rw = await call('GET', '/api-keys?accessLevel=readWrite&sort=name&order=desc&limit=3')
    expect(rw.body.data.map((k: Json) => k.accessLevel)).toEqual([
      'readWrite',
      'readWrite',
      'readWrite',
    ])
  })

  it('refuses a domain administrator', async () => {
    useScenario('anonymous-default', { signedInAs: 'reseller' })
    const { response, body } = await call('GET', '/api-keys')
    expect(response.status).toBe(403)
    expect(body.type).toBe('/api/v2/problems/forbidden')
  })
})

describe('createApiKey', () => {
  it('creates a key with its one-time secret, Location and ETag', async () => {
    useScenario('api-keys-empty')
    const { response, body } = await call('POST', '/api-keys', {
      name: 'Billing',
      ownerUsername: 'reseller',
      accessLevel: 'readOnly',
      expiresAt: null,
      allowedNetworks: ['192.0.2.7'],
    })
    expect(response.status).toBe(201)
    expect(body.data.secret).toMatch(/^mcv2_[A-Za-z0-9]{40}$/)
    expect(body.data.prefix).toBe(body.data.secret.slice(0, 12))
    expect(body.data.allowedNetworks).toEqual(['192.0.2.7/32'])
    expect(response.headers.get('location')).toBe(`/api/v2/api-keys/${body.data.id}`)
    expect(response.headers.get('etag')).toBe(body.data.etag)
    expect(mockState().apiKeys[0]).not.toHaveProperty('secret')
  })

  it('reports every validation code on its field', async () => {
    useScenario('api-key-owner-deactivated')
    const { response, body } = await call('POST', '/api-keys', {
      name: ' ',
      ownerUsername: 'former',
      accessLevel: 'readWrite',
      expiresAt: '2020-01-01T00:00:00Z',
      allowedNetworks: ['192.0.2.0/24', '999.1.1.1'],
    })
    expect(response.status).toBe(422)
    expect(
      Object.fromEntries(Object.entries(body.errors).map(([k, v]) => [k, (v as Json[])[0]!.code])),
    ).toEqual({
      name: 'required',
      ownerUsername: 'notEligible',
      expiresAt: 'mustBeInFuture',
      'allowedNetworks.1': 'invalidFormat',
    })
    expect(body.errors.ownerUsername[0].params.allowedRoles).toEqual(['admin', 'domainAdmin'])
    const missing = await call('POST', '/api-keys', {
      name: 'x',
      ownerUsername: 'nobody',
      accessLevel: 'readOnly',
    })
    expect(missing.body.errors.ownerUsername[0].code).toBe('notFound')
  })
})

describe('revokeApiKey', () => {
  it('revokes with If-Match, refuses an old tag, and is idempotent', async () => {
    useScenario('api-key-revoked-elsewhere')
    const path = `/api-keys/${ELSEWHERE_KEY.id}/revocation`
    const stale = await call('POST', path, undefined, { 'If-Match': '"old"' })
    expect(stale.response.status).toBe(412)
    const first = await call('POST', path, undefined, { 'If-Match': ELSEWHERE_KEY.etag })
    expect(first.body.data).toMatchObject({ status: 'revoked', revokedBy: { username: 'admin' } })
    expect(first.response.headers.get('etag')).toBe(first.body.data.etag)
    const again = await call('POST', path, undefined, { 'If-Match': first.body.data.etag })
    expect(again.body.data.revokedAt).toBe(first.body.data.revokedAt)
  })

  it('answers 404 for an unknown key', async () => {
    useScenario('api-keys-empty')
    expect((await call('GET', `/api-keys/${fixedKeyId(5)}`)).response.status).toBe(404)
  })
})

describe('listApiKeyOwnerCandidates', () => {
  it('lists active administrators and domain administrators only, with paging and search', async () => {
    useScenario('api-keys-many')
    const first = await call('GET', '/api-keys/owner-candidates?limit=25')
    expect(first.body.meta.total).toBe(32)
    expect(first.body.data.some((c: Json) => c.username.includes('@'))).toBe(false)
    expect(first.body.data.some((c: Json) => c.username === 'former')).toBe(false)
    const search = await call('GET', '/api-keys/owner-candidates?q=res&limit=25&offset=25')
    expect(search.body.meta.total).toBe(31)
    expect(search.body.data).toHaveLength(6)
  })
})
