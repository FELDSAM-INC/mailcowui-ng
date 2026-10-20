// UI 005 T060: the reset WebAuthn mock enforces the contract's token/session binding,
// single-use challenge, expiry and shared token-check throttle.
import { beforeEach, describe, expect, it } from 'vitest'

import { fakeAssertion } from '../../mocks/factories/webauthn'
import { mockState, useScenario } from '../../mocks/node'
import { securityKey } from '../../mocks/scenarios/accounts'
import { RESET_TOKENS } from '../../mocks/scenarios/self-service/password-reset'
import { anonymousSession } from '../../mocks/scenarios/state'

const TOKEN = RESET_TOKENS.totp
const SECOND_TOKEN = '444444-444444-444444-444444-444444'

async function send(path: string, body: unknown) {
  const csrf = await fetch(`${location.origin}/api/v2/csrf-token`)
  const csrfBody = (await csrf.json()) as { data: { token: string } }
  const response = await fetch(`${location.origin}/api/v2/password-resets${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfBody.data.token },
    body: JSON.stringify(body),
  })
  return {
    response,
    body: (await response.json()) as {
      type?: string
      retryAfter?: number
      data?: { publicKey: { challenge: string }; address?: string }
    },
  }
}

async function issue(token = TOKEN) {
  const answer = await send('/webauthn-challenge', { token })
  expect(answer.response.status).toBe(200)
  return answer.body.data!.publicKey.challenge
}

function complete(challenge: string, token: string = TOKEN) {
  return send('/completion', {
    token,
    newPassword: 'summer2026x',
    secondFactor: { type: 'webauthn', credential: fakeAssertion('Y3JlZA', challenge) },
  })
}

async function expectRejected(challenge: string, token: string = TOKEN) {
  const answer = await complete(challenge, token)
  expect(answer.response.status).toBe(401)
  expect(answer.body.type).toBe('/api/v2/problems/second-factor-failed')
  expect((await send('/token-check', { token })).response.status).toBe(200)
}

describe('password reset WebAuthn challenges', () => {
  beforeEach(() => {
    useScenario('account-password-reset', {
      accounts: { 'alice@example.org': { secondFactors: [securityKey(12, 'Security key')] } },
    })
  })

  it('accepts a fresh assertion for the token and issuing browser session', async () => {
    const answer = await complete(await issue())
    expect(answer.response.status).toBe(200)
    expect(answer.body.data?.address).toBe('alice@example.org')
  })

  it('rejects a proof without an issued challenge without consuming the reset token', async () => {
    await expectRejected('YWJzZW50LWNoYWxsZW5nZQ')
  })

  it('rejects a challenge belonging to another reset token of the same account', async () => {
    mockState().selfService.resetTokens.push({
      token: SECOND_TOKEN,
      username: 'alice@example.org',
      expiresAt: mockState().now() + 15 * 60_000,
      used: false,
    })
    const challenge = await issue()
    await expectRejected(challenge, SECOND_TOKEN)
    await expectRejected(challenge)
    expect((await complete(await issue())).response.status).toBe(200)
  })

  it('rejects a challenge from the preceding browser session', async () => {
    const challenge = await issue()
    mockState().session = anonymousSession(mockState().now())
    await expectRejected(challenge)
    expect((await complete(await issue())).response.status).toBe(200)
  })

  it('rejects an expired challenge while the reset token remains valid', async () => {
    const challenge = await issue()
    const later = mockState().now() + 5 * 60_000 + 1
    mockState().now = () => later
    await expectRejected(challenge)
    expect((await complete(await issue())).response.status).toBe(200)
  })

  it('consumes the challenge on a failed verification so the same proof cannot be retried', async () => {
    const challenge = await issue()
    await expectRejected('d3JvbmctY2hhbGxlbmdl')
    await expectRejected(challenge)
    expect((await complete(await issue())).response.status).toBe(200)
  })

  it('replaces the preceding challenge when another one is requested', async () => {
    const previous = await issue()
    const current = await issue()
    expect(current).not.toBe(previous)
    await expectRejected(previous)
    await expectRejected(current)
    expect((await complete(await issue())).response.status).toBe(200)
  })

  it('shares the client token-check throttle across tokens and reports Retry-After for the next challenge', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await send('/token-check', { token: RESET_TOKENS.plain })).response.status).toBe(200)
      await issue()
    }
    const answer = await send('/webauthn-challenge', { token: TOKEN })
    expect(answer.response.status).toBe(429)
    expect(answer.body.type).toBe('/api/v2/problems/too-many-requests')
    expect(Number(answer.response.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(answer.body.retryAfter).toBe(Number(answer.response.headers.get('retry-after')))
  })

  it('counts completion attempts across reset tokens of the same client', async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const token = attempt % 2 === 0 ? RESET_TOKENS.plain : TOKEN
      const answer = await send('/completion', { token, newPassword: 'x' })
      expect(answer.response.status).toBe(422)
    }
    const answer = await send('/completion', {
      token: RESET_TOKENS.plain,
      newPassword: 'summer2026x',
    })
    expect(answer.response.status).toBe(429)
    expect(answer.body.type).toBe('/api/v2/problems/too-many-requests')
  })

  it('refuses challenges when password reset is unavailable or the account has no WebAuthn factor', async () => {
    mockState().selfService.passwordResetAvailable = false
    const unavailable = await send('/webauthn-challenge', { token: TOKEN })
    expect(unavailable.response.status).toBe(403)
    expect(unavailable.body.type).toBe('/api/v2/problems/password-reset-unavailable')
    mockState().selfService.passwordResetAvailable = true
    const noFactor = await send('/webauthn-challenge', { token: RESET_TOKENS.plain })
    expect(noFactor.response.status).toBe(400)
    expect(noFactor.body.type).toBe('/api/v2/problems/invalid-reset-token')
  })
})
