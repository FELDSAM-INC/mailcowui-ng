// The US1 mock handlers (T066): password sign-in, the second-factor step and their refusals.
import { describe, expect, it } from 'vitest'

import { fakeAssertion } from '../../mocks/factories/webauthn'
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

const signIn = (username: string, password = MOCK_PASSWORD, role?: string) =>
  send('POST', '/session', { username, password, ...(role ? { role } : {}) })

describe('password sign-in', () => {
  it('signs an administrator without second factors in', async () => {
    useScenario('admin-password')
    const { response, body } = await signIn('Admin ')
    expect(response.status).toBe(201)
    expect(response.headers.get('location')).toBe('/api/v2/session')
    expect(body?.data).toMatchObject({ state: 'active', username: 'admin', authMethod: 'password' })
  })

  it('answers one generic failure and counts it', async () => {
    useScenario('admin-password')
    const { response, body } = await signIn('admin', 'wrong')
    expect(response.status).toBe(401)
    expect(body?.type).toBe('/api/v2/problems/sign-in-failed')
    expect(mockState().failedSignIns).toBe(1)
    expect((await signIn('nobody')).body?.type).toBe('/api/v2/problems/sign-in-failed')
  })

  it('refuses a role mismatch generically', async () => {
    useScenario('admin-password')
    expect((await signIn('admin', MOCK_PASSWORD, 'mailboxUser')).response.status).toBe(401)
  })

  it('throttles with retryAfter and Retry-After', async () => {
    useScenario('throttled')
    const { response, body } = await signIn('admin')
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('90')
    expect(body?.retryAfter).toBe(90)
  })

  it('answers second-factor-unavailable for U2F-only accounts', async () => {
    useScenario('u2f-only')
    const { response, body } = await signIn('alice@example.org')
    expect(response.status).toBe(403)
    expect(body?.type).toBe('/api/v2/problems/second-factor-unavailable')
  })

  it('opens a restricted session for an account with pending actions', async () => {
    useScenario('admin-password')
    const { body } = await signIn('bob@example.org')
    expect(body?.data).toMatchObject({ state: 'restricted', pendingActions: ['passwordChange'] })
  })
})

describe('second-factor step', () => {
  it('lists the methods in the recommended order', async () => {
    useScenario('mailbox-all-factors')
    const { body } = await signIn('alice@example.org')
    expect(body?.data.state).toBe('pendingSecondFactor')
    expect(body?.data.pendingSignIn.methods.map((m: { type: string }) => m.type)).toEqual([
      'webauthn',
      'totp',
      'yubiOtp',
    ])
  })

  it('accepts a TOTP code and signs in', async () => {
    useScenario('mailbox-all-factors')
    await signIn('alice@example.org')
    const { response, body } = await send('POST', '/session/pending-sign-in/second-factor', {
      type: 'totp',
      methodId: 12,
      code: '123456',
    })
    expect(response.status).toBe(200)
    expect(body?.data).toMatchObject({ state: 'active', authMethod: 'passwordAndSecondFactor' })
  })

  it('cancels the pending sign-in after a wrong code', async () => {
    useScenario('mailbox-all-factors')
    await signIn('alice@example.org')
    const { response, body } = await send('POST', '/session/pending-sign-in/second-factor', {
      type: 'totp',
      methodId: 12,
      code: '000000',
    })
    expect(response.status).toBe(401)
    expect(body?.type).toBe('/api/v2/problems/second-factor-failed')
    expect(mockState().session.state).toBe('anonymous')
  })

  it('keeps the step open during a Yubico outage', async () => {
    useScenario('yubico-outage')
    await signIn('alice@example.org')
    const { response } = await send('POST', '/session/pending-sign-in/second-factor', {
      type: 'yubiOtp',
      otp: 'cccccbcgujhingjrdejhgfnuetrgigvejhhgbkugdedf',
    })
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('30')
    expect(mockState().session.state).toBe('pendingSecondFactor')
  })

  it('verifies a WebAuthn assertion against a fresh challenge', async () => {
    useScenario('mailbox-all-factors')
    await signIn('alice@example.org')
    const challenge = await send('POST', '/session/pending-sign-in/webauthn-challenge')
    expect(challenge.response.status).toBe(200)
    const credential = fakeAssertion('Y3JlZA', challenge.body?.data.publicKey.challenge)
    const { body } = await send('POST', '/session/pending-sign-in/second-factor', {
      type: 'webauthn',
      credential,
    })
    expect(body?.data.state).toBe('active')
  })

  it('cancels a pending sign-in idempotently', async () => {
    useScenario('mailbox-all-factors')
    await signIn('alice@example.org')
    expect((await send('DELETE', '/session/pending-sign-in')).response.status).toBe(204)
    expect(mockState().session.state).toBe('anonymous')
    expect((await send('DELETE', '/session/pending-sign-in')).response.status).toBe(204)
  })

  it('reports an expired step as sign-in-expired', async () => {
    useScenario('mailbox-all-factors')
    await signIn('alice@example.org')
    mockState().session.pendingSignIn!.expiresAt = new Date(Date.now() - 1000).toISOString()
    const { body } = await send('POST', '/session/pending-sign-in/second-factor', {
      type: 'totp',
      methodId: 12,
      code: '123456',
    })
    expect(body?.type).toBe('/api/v2/problems/sign-in-expired')
  })
})
