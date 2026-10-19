// The identity provider mock handlers (UI 012 T016, T066, research R24):
// every response passes the contract validator (the setup file fails a test on any violation), and
// each documented behaviour of API 012 that the screens rely on holds.
import { describe, expect, it } from 'vitest'

import { useScenario } from '../../mocks/node'

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
  options: { body?: unknown; headers?: Record<string, string> } = {},
): Promise<Answer> {
  const headers: Record<string, string> = { ...options.headers }
  if (method !== 'GET') headers['X-CSRF-Token'] = await csrfToken()
  if (options.body !== undefined) {
    headers['Content-Type'] =
      method === 'PATCH' ? 'application/merge-patch+json' : 'application/json'
  }
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

const ldap = {
  type: 'ldap',
  hosts: ['ldap1.example.org'],
  baseDn: 'dc=example,dc=org',
  bindDn: 'cn=admin,dc=example,dc=org',
  attributeField: 'Title',
  usernameField: 'Mail',
  useSsl: true,
  useStartTls: true,
  attributeMapping: [{ attributeValue: 'staff', template: 'Staff' }],
}

describe('identity provider handlers', () => {
  it('answers 404 before the first save and creates with If-None-Match: *', async () => {
    useScenario('idp-none')
    expect((await call('GET', '/identity-provider')).body.type).toBe(
      '/api/v2/problems/identity-provider-not-configured',
    )
    const missing = await call('PUT', '/identity-provider', {
      body: ldap,
      headers: { 'If-None-Match': '*' },
    })
    expect(missing.status).toBe(422)
    expect(missing.body.errors.bindPassword[0].params.reason).toBe('noStoredSecret')
    const created = await call('PUT', '/identity-provider', {
      body: { ...ldap, bindPassword: 'secret' },
      headers: { 'If-None-Match': '*' },
    })
    expect(created.status).toBe(201)
    expect(created.body.data).toMatchObject({
      type: 'ldap',
      bindPasswordSet: true,
      usernameField: 'mail',
      attributeField: 'title',
      useStartTls: false,
      effectivePort: 636,
      complete: true,
    })
    expect(JSON.stringify(created.body)).not.toContain('secret"')
    const again = await call('PUT', '/identity-provider', {
      body: { ...ldap, bindPassword: 'secret' },
      headers: { 'If-None-Match': '*' },
    })
    expect(again.status).toBe(412)
  })

  it('patches with If-Match, requires the secret for new hosts and answers 412 when outdated', async () => {
    useScenario('idp-ldap')
    const read = await call('GET', '/identity-provider')
    const etag = read.body.data.etag as string
    const hosts = await call('PATCH', '/identity-provider', {
      body: { hosts: ['ldap2.example.org'] },
      headers: { 'If-Match': etag },
    })
    expect(hosts.status).toBe(422)
    expect(hosts.body.errors.bindPassword[0].params).toMatchObject({ reason: 'addressChanged' })
    const saved = await call('PATCH', '/identity-provider', {
      body: { syncInterval: 60 },
      headers: { 'If-Match': etag },
    })
    expect(saved.status).toBe(200)
    expect(saved.body.data.syncInterval).toBe(60)
    const stale = await call('PATCH', '/identity-provider', {
      body: { syncInterval: 30 },
      headers: { 'If-Match': etag },
    })
    expect(stale.status).toBe(412)
    const typed = await call('PATCH', '/identity-provider', {
      body: { type: 'keycloak' },
      headers: { 'If-Match': saved.body.data.etag },
    })
    expect(typed.body.errors.type[0].code).toBe('immutable')
  })

  it('refuses a type change and a removal while mailboxes use other sources', async () => {
    useScenario('idp-other-source')
    const etag = (await call('GET', '/identity-provider')).body.data.etag as string
    const removal = await call('DELETE', '/identity-provider', { headers: { 'If-Match': etag } })
    expect(removal.status).toBe(409)
    expect(removal.body).toMatchObject({ blockingMailboxes: 3 })
    const keycloak = await call('PUT', '/identity-provider', {
      headers: { 'If-Match': etag },
      body: {
        type: 'keycloak',
        serverUrl: 'https://sso.example.org/',
        realm: 'example',
        clientId: 'mailcow',
        clientSecret: 'x',
        version: '26',
        legacyReturnUrl: 'https://mail.example.org',
      },
    })
    expect(keycloak.status).toBe(409)
  })

  it('removes a configuration nobody uses', async () => {
    useScenario('idp-ldap')
    const etag = (await call('GET', '/identity-provider')).body.data.etag as string
    expect(
      (await call('DELETE', '/identity-provider', { headers: { 'If-Match': etag } })).status,
    ).toBe(204)
    expect((await call('GET', '/identity-provider')).status).toBe(404)
  })

  it('tests candidates: the stored secret only for the same address, outcomes in sequence', async () => {
    const state = useScenario('idp-ldap')
    state.identityProvider.connectionTest = {
      outcome: 'success',
      sequence: ['credentialsRejected'],
    }
    const stored = { ...ldap, attributeField: 'title' }
    const first = await call('POST', '/identity-provider/connection-tests', { body: stored })
    expect(first.body.data).toMatchObject({
      outcome: 'failure',
      failureCategory: 'credentialsRejected',
      testedAddress: 'ldaps://ldap1.example.org:636',
    })
    const second = await call('POST', '/identity-provider/connection-tests', { body: stored })
    expect(second.body.data.outcome).toBe('success')
    const moved = await call('POST', '/identity-provider/connection-tests', {
      body: { ...stored, hosts: ['ldap9.example.org'] },
    })
    expect(moved.status).toBe(422)
  })

  it('reports unknown templates and repeated values', async () => {
    useScenario('idp-none')
    const answer = await call('PUT', '/identity-provider', {
      body: {
        ...ldap,
        bindPassword: 'x',
        attributeMapping: [
          { attributeValue: 'a', template: 'Nope' },
          { attributeValue: 'a', template: 'Staff' },
        ],
      },
    })
    expect(answer.body.errors['attributeMapping.0.template'][0].params.resource).toBe(
      'mailboxTemplate',
    )
    expect(answer.body.errors['attributeMapping.1.attributeValue'][0].code).toBe('duplicate')
  })
})
