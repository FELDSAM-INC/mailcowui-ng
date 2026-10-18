// The UI 012 mock handlers of single sign-on and provider passwords (T040, T060): the pending
// state, the completion outcomes, the provider-error report, the end of a provider session and the
// password sign-in of LDAP and Keycloak mailboxes.
import { describe, expect, it } from 'vitest'

import { MOCK_PASSWORD } from '../../mocks/scenarios/accounts'
import { mockState, useScenario } from '../../mocks/node'

const api = (path: string) => `${location.origin}/api/v2${path}`

async function csrf(): Promise<string> {
  const body = (await (await fetch(api('/csrf-token'))).json()) as { data: { token: string } }
  return body.data.token
}

async function send(method: string, path: string, body?: unknown) {
  const response = await fetch(api(path), {
    method,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await csrf() },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- free-form JSON in assertions
  return { response, body: text ? (JSON.parse(text) as Record<string, any>) : null }
}

async function start(): Promise<string> {
  const { response, body } = await send('POST', '/session/single-sign-on')
  expect(response.status).toBe(200)
  const url = new URL(body?.data.authorizationUrl as string)
  expect(url.origin).toBe('https://idp.example.test')
  expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  expect(url.searchParams.get('redirect_uri')).toMatch(/\/ng\/sso\/return$/)
  return url.searchParams.get('state')!
}

describe('single sign-on', () => {
  it('completes with the pending state once and signs the mailbox in', async () => {
    useScenario('sso-available')
    const state = await start()
    const { response, body } = await send('POST', '/session/single-sign-on/completion', {
      code: 'mock-code-1',
      state,
    })
    expect(response.status).toBe(201)
    expect(body?.data).toMatchObject({
      state: 'active',
      username: 'anna@example.org',
      authMethod: 'singleSignOn',
    })
    const me = (await (await fetch(api('/me'))).json()) as { data: { authentication: unknown } }
    expect(me.data.authentication).toEqual({ method: 'singleSignOn', identityProvider: 'keycloak' })
    const again = await send('POST', '/session/single-sign-on/completion', {
      code: 'mock-code-1',
      state,
    })
    expect(again.body?.type).toBe('/api/v2/problems/sign-in-state-invalid')
  })

  it('refuses a foreign state and consumes the pending one', async () => {
    useScenario('sso-available')
    await start()
    const { response, body } = await send('POST', '/session/single-sign-on/completion', {
      code: 'x',
      state: 'not-the-state',
    })
    expect(response.status).toBe(401)
    expect(body?.type).toBe('/api/v2/problems/sign-in-state-invalid')
    expect(mockState().singleSignOn.pending).toBeNull()
  })

  it.each([
    ['sso-refused', 401, 'sign-in-failed'],
    ['sso-provider-down', 503, 'identity-provider-unavailable'],
    ['sso-disabled-after-start', 409, 'single-sign-on-not-available'],
  ])('%s answers %s %s', async (name, status, type) => {
    useScenario(name)
    const state = await start()
    const { response, body } = await send('POST', '/session/single-sign-on/completion', {
      code: 'c',
      state,
    })
    expect(response.status).toBe(status)
    expect(body?.type).toBe(`/api/v2/problems/${type}`)
    if (status === 503) expect(response.headers.get('retry-after')).toBe('30')
  })

  it('creates the mailbox at the first sign-in', async () => {
    useScenario('sso-auto-create')
    const state = await start()
    const { body } = await send('POST', '/session/single-sign-on/completion', { code: 'c', state })
    expect(body?.data.username).toBe('new.user@example.org')
  })

  it('refuses the start when single sign-on is not offered', async () => {
    for (const name of ['sso-not-available-on-start', 'anonymous-default']) {
      useScenario(name)
      const { response, body } = await send('POST', '/session/single-sign-on')
      expect(response.status).toBe(409)
      expect(body?.type).toBe('/api/v2/problems/single-sign-on-not-available')
    }
  })

  it('reports a provider error with the state, and cancels', async () => {
    useScenario('sso-available')
    const state = await start()
    const report = await send('POST', '/session/single-sign-on/provider-error', {
      error: 'access_denied',
      state,
    })
    expect(report.response.status).toBe(204)
    const second = await send('POST', '/session/single-sign-on/provider-error', {
      error: 'access_denied',
      state,
    })
    expect(second.response.status).toBe(401)
    await start()
    expect((await send('DELETE', '/session/single-sign-on')).response.status).toBe(204)
    expect(mockState().singleSignOn.pending).toBeNull()
  })

  it('ends a single sign-on session when the provider ends it', async () => {
    useScenario('sso-session-ends')
    expect((await fetch(api('/me'))).status).toBe(200)
    mockState().singleSignOn.endIdpSession = true
    const response = await fetch(api('/me'))
    expect(response.status).toBe(401)
    expect(((await response.json()) as { type: string }).type).toBe(
      '/api/v2/problems/identity-provider-session-ended',
    )
    expect(mockState().session.state).toBe('anonymous')
  })
})

describe('password sign-in through the provider', () => {
  const signIn = (username: string, password = MOCK_PASSWORD) =>
    send('POST', '/session', { username, password })

  it('names the directory and provider password methods', async () => {
    useScenario('ldap-password')
    expect((await signIn('carl@example.org')).body?.data.authMethod).toBe('directoryPassword')
    useScenario('keycloak-password-forced-2fa')
    const { body } = await signIn('dave@example.org')
    expect(body?.data).toMatchObject({ state: 'restricted', authMethod: 'providerPassword' })
  })

  it('asks LDAP accounts with an authenticator app for the second factor', async () => {
    useScenario('ldap-password-totp')
    expect((await signIn('carl@example.org')).body?.data.state).toBe('pendingSecondFactor')
  })

  it('answers 503 while the directory is down, without counting the attempt', async () => {
    useScenario('ldap-provider-down')
    const { response, body } = await signIn('carl@example.org')
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('30')
    expect(body?.type).toBe('/api/v2/problems/identity-provider-unavailable')
    expect(mockState().failedSignIns).toBe(0)
  })
})
