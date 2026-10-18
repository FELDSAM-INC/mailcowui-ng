// The US1 mock handlers (T066): password sign-in, the second-factor step and their refusals.
import { describe, expect, it } from 'vitest'

import { fakeAssertion, fakeRegistration, SEEDED_CREDENTIALS } from '../../mocks/factories/webauthn'
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

describe('passkey sign-in (T085)', () => {
  const assertion = async (credentialId: string, role?: string) => {
    const challenge = await send('POST', '/session/passkey-challenge')
    const credential = fakeAssertion(credentialId, challenge.body?.data.publicKey.challenge)
    return send('POST', '/session/passkey-assertion', { credential, ...(role ? { role } : {}) })
  }

  it('signs the owner of a known credential in, without a second factor', async () => {
    useScenario('passkey-user')
    const { response, body } = await assertion(SEEDED_CREDENTIALS.alice)
    expect(response.status).toBe(201)
    expect(body?.data).toMatchObject({ state: 'active', authMethod: 'passkey' })
  })

  it('fails generically for unknown credentials and other roles', async () => {
    useScenario('passkey-user')
    expect((await assertion(SEEDED_CREDENTIALS.unknown)).body?.type).toBe(
      '/api/v2/problems/sign-in-failed',
    )
    expect((await assertion(SEEDED_CREDENTIALS.alice, 'domainAdmin')).body?.type).toBe(
      '/api/v2/problems/sign-in-failed',
    )
  })

  it('treats a replaced challenge as expired', async () => {
    useScenario('passkey-user')
    const first = await send('POST', '/session/passkey-challenge')
    await send('POST', '/session/passkey-challenge')
    const credential = fakeAssertion(SEEDED_CREDENTIALS.alice, first.body?.data.publicKey.challenge)
    const { body } = await send('POST', '/session/passkey-assertion', { credential })
    expect(body?.type).toBe('/api/v2/problems/sign-in-expired')
  })

  it('restricts the session of an account forced to change its password', async () => {
    useScenario('passkey-forced-password-change')
    const { body } = await assertion(SEEDED_CREDENTIALS.bob)
    expect(body?.data).toMatchObject({ state: 'restricted', pendingActions: ['passwordChange'] })
  })

  it('throttles passkey sign-in', async () => {
    useScenario('passkey-throttled')
    expect((await assertion(SEEDED_CREDENTIALS.alice)).response.status).toBe(429)
  })
})

describe('own passkeys (T101)', () => {
  it('lists newest first with paging metadata', async () => {
    useScenario('user-with-passkeys')
    const response = await fetch(api('/me/passkeys?sort=registeredAt&order=desc&limit=2'))
    const body = (await response.json()) as { data: { name: string | null }[]; meta: unknown }
    expect(body.data.map((p) => p.name)).toEqual([null, 'Lost key'])
    expect(body.meta).toEqual({ total: 4, limit: 2, offset: 0 })
  })

  it('registers a passkey once and refuses the same credential again', async () => {
    useScenario('admin-no-passkeys')
    const options = await send('POST', '/me/passkeys/registration-options')
    const credential = fakeRegistration('Y3JlZC1uZXc', options.body?.data.publicKey.challenge)
    const created = await send('POST', '/me/passkeys', { credential, name: 'Laptop' })
    expect(created.response.status).toBe(201)
    expect(created.response.headers.get('etag')).toBe(created.body?.data.etag)
    const again = await send('POST', '/me/passkeys/registration-options')
    expect(again.body?.data.publicKey.excludeCredentials).toEqual([
      { type: 'public-key', id: 'Y3JlZC1uZXc' },
    ])
    const duplicate = fakeRegistration('Y3JlZC1uZXc', again.body?.data.publicKey.challenge)
    const refused = await send('POST', '/me/passkeys', { credential: duplicate })
    expect(refused.body?.type).toBe('/api/v2/problems/passkey-registration-failed')
  })

  it('renames and removes with If-Match, answering 412 for a stale version', async () => {
    useScenario('user-with-passkeys')
    const path = `/me/passkeys/${'1'.repeat(64)}`
    const stale = await fetch(api(path), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/merge-patch+json',
        'X-CSRF-Token': await csrf(),
        'If-Match': '"old"',
      },
      body: JSON.stringify({ name: 'New' }),
    })
    expect(stale.status).toBe(412)
    const renamed = await fetch(api(path), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/merge-patch+json',
        'X-CSRF-Token': await csrf(),
        'If-Match': '"pk-phone-1"',
      },
      body: JSON.stringify({ name: 'New' }),
    })
    expect(renamed.status).toBe(200)
    const removed = await fetch(api(path), {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': await csrf(), 'If-Match': renamed.headers.get('etag') ?? '' },
    })
    expect(removed.status).toBe(204)
  })
})

describe('restricted sessions (T110)', () => {
  it('refuses other operations with the pending actions', async () => {
    useScenario('forced-password-change')
    const response = await fetch(api('/me/passkeys'))
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      type: '/api/v2/problems/pending-action-required',
      pendingActions: ['passwordChange'],
    })
    expect((await fetch(api('/me'))).status).toBe(200)
  })

  it('allows passkey registration only while second-factor setup is all that is pending', async () => {
    useScenario('forced-both')
    expect((await send('POST', '/me/passkeys/registration-options')).response.status).toBe(403)
    useScenario('forced-second-factor')
    expect((await send('POST', '/me/passkeys/registration-options')).response.status).toBe(200)
  })

  it('reads the pending actions on every request', async () => {
    useScenario('forced-password-change')
    const before = (await (await fetch(api('/session'))).json()) as { data: { state: string } }
    expect(before.data.state).toBe('restricted')
    mockState().accounts.find((a) => a.username === 'bob@example.org')!.pendingActions = []
    const after = (await (await fetch(api('/session'))).json()) as { data: { state: string } }
    expect(after.data.state).toBe('active')
  })
})

describe('preferences (T116)', () => {
  const patch = async (body: unknown, ifMatch?: string) =>
    fetch(api('/me/preferences'), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/merge-patch+json',
        'X-CSRF-Token': await csrf(),
        ...(ifMatch ? { 'If-Match': ifMatch } : {}),
      },
      body: JSON.stringify(body),
    })

  it('saves a merge patch with If-Match and answers 412 for a stale version', async () => {
    useScenario('admin-active')
    expect((await patch({ theme: 'dark' }, '"old"')).status).toBe(412)
    const saved = await patch({ language: 'cs-cz' }, '"pref-1"')
    expect(saved.status).toBe(200)
    const body = (await saved.json()) as { data: { language: string; theme: string } }
    expect(body.data).toMatchObject({ language: 'cs-cz', theme: 'system' })
    expect(saved.headers.get('etag')).toMatch(/^"pref-v\d+"$/)
  })

  it('refuses a language the server does not enable', async () => {
    useScenario('admin-active', { publicConfig: 'languages-en-cs' })
    const refused = await patch({ language: 'sk-sk' })
    expect(refused.status).toBe(422)
    expect(await refused.json()).toMatchObject({
      errors: { language: [{ code: 'notInList', params: { allowed: ['cs-cz', 'en-gb'] } }] },
    })
  })

  it('reads a language that is no longer enabled as the default and refuses restricted sessions', async () => {
    useScenario('profile-language-disabled', { signedInAs: 'admin' })
    const me = (await (await fetch(api('/me'))).json()) as {
      data: { preferences: { language: string } }
    }
    expect(me.data.preferences.language).toBe('cs-cz')
    useScenario('forced-password-change')
    expect((await patch({ theme: 'dark' })).status).toBe(403)
  })
})
