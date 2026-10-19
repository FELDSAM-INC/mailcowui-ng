// The self-service mock handlers (UI 005 T012 and the stories' handler tasks, research R24): every
// response passes the contract validator (the setup file fails a test on any violation), and each
// documented behaviour of API 005 holds on the scenario state.
import { describe, expect, it } from 'vitest'

import { useScenario } from '../../mocks/node'

const api = (path: string) => `${location.origin}/api/v2${path}`

export interface Answer {
  status: number
  headers: Headers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any
}

async function csrfToken(): Promise<string> {
  const response = await fetch(api('/csrf-token'))
  return ((await response.json()) as { data: { token: string } }).data.token
}

export async function call(
  method: string,
  path: string,
  options: { body?: unknown; ifMatch?: string; patch?: boolean } = {},
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
  const json = (response.headers.get('content-type') ?? '').includes('json')
  return {
    status: response.status,
    headers: response.headers,
    body: text && json ? JSON.parse(text) : text || undefined,
  }
}

const problemName = (answer: Answer) =>
  String(answer.body?.type ?? '')
    .split('/')
    .at(-1)

describe('getSelfServiceCapabilities', () => {
  it('answers only passwordReset when signed out', async () => {
    useScenario('anonymous-default')
    const answer = await call('GET', '/capabilities/self-service')
    expect(answer.status).toBe(200)
    expect(Object.keys(answer.body.data)).toEqual(['passwordReset'])
  })

  it('adds every member and the account for a session', async () => {
    useScenario('account-mailbox')
    const answer = await call('GET', '/capabilities/self-service')
    expect(answer.body.data.account).toEqual({
      role: 'mailboxUser',
      secondFactorRequired: false,
      passwordChangeAvailable: true,
      secondFactorManagementAvailable: true,
    })
    expect(answer.body.data.groupware.enabled).toBe(true)
  })

  it('reports an externally managed password and the unreadable read', async () => {
    useScenario('account-external-source')
    const external = await call('GET', '/capabilities/self-service')
    expect(external.body.data.account.passwordChangeAvailable).toBe(false)
    useScenario('account-capabilities-unavailable')
    expect((await call('GET', '/capabilities/self-service')).status).toBe(500)
  })

  it('is readable in a restricted session', async () => {
    useScenario('forced-password-change')
    const answer = await call('GET', '/capabilities/self-service')
    expect(answer.status).toBe(200)
    expect(answer.body.data.account.role).toBe('mailboxUser')
  })
})

describe('getOwnMailboxOverview', () => {
  it("answers anna's overview", async () => {
    useScenario('account-mailbox')
    const answer = await call('GET', '/me/mailbox')
    expect(answer.status).toBe(200)
    expect(answer.body.data).toMatchObject({
      address: 'anna@example.org',
      quota: { quotaBytes: 1024 ** 3, usedBytes: 256 * 1024 ** 2, percentUsed: 25 },
      activeAppPasswords: 3,
      webmail: { enabled: true, redirectAfterSignIn: false },
    })
  })

  it('refuses other roles and restricted sessions', async () => {
    useScenario('account-admin')
    const admin = await call('GET', '/me/mailbox')
    expect([admin.status, problemName(admin)]).toEqual([403, 'forbidden'])
    useScenario('forced-password-change')
    const restricted = await call('GET', '/me/mailbox')
    expect([restricted.status, problemName(restricted)]).toEqual([403, 'pending-action-required'])
  })
})

describe('the own password (T038)', () => {
  const MOCK = 'Passw0rd!mock'

  it('checks the current password, the policy and pre-hashed values', async () => {
    useScenario('account-domain-admin')
    const wrong = await call('PUT', '/me/password', {
      body: { currentPassword: 'nope', newPassword: 'summer2026x', endOtherSessions: true },
    })
    expect([wrong.status, problemName(wrong)]).toEqual([403, 'current-password-incorrect'])
    const weak = await call('PUT', '/me/password', {
      body: { currentPassword: MOCK, newPassword: 'summer', endOtherSessions: true },
    })
    expect(weak.status).toBe(422)
    expect(weak.body.errors.newPassword.map((v: { code: string }) => v.code)).toEqual([
      'tooShort',
      'missingCharacterClass',
    ])
    const hashed = await call('PUT', '/me/password', {
      body: { currentPassword: MOCK, newPassword: '{SSHA512}abc', endOtherSessions: true },
    })
    expect(hashed.body.errors.newPassword[0].code).toBe('preHashedPassword')
  })

  it('ends and counts the other sessions unless asked not to', async () => {
    useScenario('account-domain-admin')
    const kept = await call('PUT', '/me/password', {
      body: { currentPassword: MOCK, newPassword: 'summer2026x', endOtherSessions: false },
    })
    expect(kept.body.data).toEqual({
      sessionsEnded: 0,
      activeAppPasswords: 0,
      mailServerCacheSeconds: 300,
    })
    const ended = await call('PUT', '/me/password', {
      body: { currentPassword: 'summer2026x', newPassword: 'winter2026x', endOtherSessions: true },
    })
    expect(ended.body.data.sessionsEnded).toBe(2)
  })

  it('answers 429 after ten wrong current passwords', async () => {
    useScenario('account-password-throttled')
    const answer = await call('PUT', '/me/password', {
      body: { currentPassword: MOCK, newPassword: 'summer2026x', endOtherSessions: true },
    })
    expect([answer.status, problemName(answer)]).toEqual([429, 'too-many-requests'])
  })

  it('lets a session restricted by a forced change read the policy and change it', async () => {
    useScenario('forced-password-change')
    expect((await call('GET', '/me/password-policy')).status).toBe(200)
    const answer = await call('PUT', '/me/password', {
      body: { newPassword: 'summer2026x', endOtherSessions: true },
    })
    expect(answer.status).toBe(200)
    expect((await call('GET', '/session')).body.data.state).toBe('active')
  })

  it('refuses a session restricted only by second-factor setup, and external passwords', async () => {
    useScenario('forced-second-factor')
    const restricted = await call('GET', '/me/password-policy')
    expect(problemName(restricted)).toBe('pending-action-required')
    useScenario('account-external-source')
    const external = await call('PUT', '/me/password', {
      body: { currentPassword: MOCK, newPassword: 'summer2026x', endOtherSessions: true },
    })
    expect(problemName(external)).toBe('password-managed-externally')
  })
})

describe('the own second factors (T047)', () => {
  const MOCK = 'Passw0rd!mock'

  it('lists the entries with their states and the sign-in entry', async () => {
    useScenario('account-two-factor-inactive-and-unsupported')
    const answer = await call('GET', '/me/second-factors?sort=id')
    expect(
      answer.body.data.map((item: { id: number; active: boolean; usable: boolean }) => [
        item.id,
        item.active,
        item.usable,
      ]),
    ).toEqual([
      [21, true, true],
      [23, false, true],
      [24, true, false],
    ])
    expect(answer.body.data[0].usedForCurrentSignIn).toBe(true)
  })

  it('enrols a TOTP factor with a code of the shown secret, with five attempts', async () => {
    const { totpCode } = await import('../../support/totp')
    useScenario('account-two-factor-empty')
    const started = await call('POST', '/me/second-factors/totp-enrolment')
    expect(started.body.data.secret).toMatch(/^[A-Z2-7]{32}$/)
    expect(started.body.data.qrCode).toMatch(/^data:image\/svg\+xml;base64,/)
    const wrong = await call('POST', '/me/second-factors', {
      body: { type: 'totp', name: 'Phone', code: '000000', currentPassword: MOCK },
    })
    expect(wrong.body.attemptsRemaining).toBe(4)
    const right = await call('POST', '/me/second-factors', {
      body: {
        type: 'totp',
        name: 'Phone',
        code: totpCode(started.body.data.secret, Date.now()),
        currentPassword: MOCK,
      },
    })
    expect(right.status).toBe(201)
    expect(right.body.data.type).toBe('totp')
  })

  it('refuses the only active entry, and anything under the policy', async () => {
    useScenario('account-two-factor-single-active')
    const only = await call('DELETE', '/me/second-factors/21')
    expect([only.status, problemName(only)]).toEqual([409, 'last-second-factor'])
    useScenario('account-two-factor-required-by-policy')
    const policy = await call('DELETE', '/me/second-factors/22')
    expect(problemName(policy)).toBe('second-factor-required-by-policy')
    useScenario('account-two-factor-two-active')
    expect((await call('DELETE', '/me/second-factors/22')).status).toBe(204)
  })

  it('removes all entries with the current password', async () => {
    useScenario('account-two-factor-single-active')
    const wrong = await call('POST', '/me/second-factors/removal', {
      body: { currentPassword: 'nope' },
    })
    expect(problemName(wrong)).toBe('current-password-incorrect')
    expect(
      (await call('POST', '/me/second-factors/removal', { body: { currentPassword: MOCK } }))
        .status,
    ).toBe(204)
    expect((await call('GET', '/me/second-factors')).body.data).toEqual([])
  })

  it('enrols without the password in a restricted session and lifts the restriction', async () => {
    useScenario('forced-second-factor')
    const yubico = await call('POST', '/me/second-factors', {
      body: {
        type: 'yubiOtp',
        name: 'YubiKey',
        clientId: '12345',
        secretKey: 'secret',
        otp: 'cccccbcgujhingjrdejhgfnuetrgigvejhhgbkugdedf',
      },
    })
    expect(yubico.status).toBe(201)
    expect((await call('GET', '/session')).body.data.state).toBe('active')
  })

  it('answers the Yubico outage with 503', async () => {
    useScenario('account-yubico-outage-enrolment')
    const answer = await call('POST', '/me/second-factors', {
      body: {
        type: 'yubiOtp',
        name: 'YubiKey',
        clientId: '12345',
        secretKey: 'secret',
        otp: 'cccccbcgujhingjrdejhgfnuetrgigvejhhgbkugdedf',
        currentPassword: MOCK,
      },
    })
    expect([answer.status, problemName(answer)]).toEqual([503, 'temporary-verification-failure'])
  })
})

describe('the recovery address and the password reset (T060)', () => {
  const MOCK = 'Passw0rd!mock'
  const TOKENS = {
    plain: '3F9A1C-0B7E22-9D4F10-A6C3E8-51B2D7',
    totp: '7B21D0-55AE19-C0FFEE-12AB34-9E8D7C',
    expired: '000000-EXPIRED-000000-000000-000000',
    unsupported: '222222-U2FONLY-222222-222222-22222',
  }

  it('replaces the recovery address with the current password, If-Match and the pwReset flag', async () => {
    useScenario('account-mailbox')
    const read = await call('GET', '/me/recovery-email')
    expect(read.body.data.address).toBe('anna.private@example.net')
    const changed = await call('PUT', '/me/recovery-email', {
      body: { address: 'anna@example.net', currentPassword: MOCK },
      ifMatch: read.body.data.etag,
    })
    expect(changed.body.data.address).toBe('anna@example.net')
    const stale = await call('PUT', '/me/recovery-email', {
      body: { address: null, currentPassword: MOCK },
      ifMatch: read.body.data.etag,
    })
    expect(stale.status).toBe(412)
    useScenario('account-mailbox-no-pw-reset')
    const refused = await call('PUT', '/me/recovery-email', {
      body: { address: 'other@example.net', currentPassword: MOCK },
    })
    expect(problemName(refused)).toBe('permission-flag-required')
  })

  it('acknowledges every well-formed address the same way', async () => {
    useScenario('account-password-reset')
    for (const address of ['carl@example.org', 'nobody@example.org']) {
      const answer = await call('POST', '/password-resets', { body: { address } })
      expect(answer.body.data).toEqual({ tokenLifetimeMinutes: 15 })
    }
    useScenario('account-password-reset-unavailable')
    const off = await call('POST', '/password-resets', { body: { address: 'carl@example.org' } })
    expect(problemName(off)).toBe('password-reset-unavailable')
  })

  it('checks tokens and asks for the second factor after the password rules', async () => {
    useScenario('account-password-reset')
    const plain = await call('POST', '/password-resets/token-check', {
      body: { token: TOKENS.plain },
    })
    expect(plain.body.data).toMatchObject({
      address: 'carl@example.org',
      secondFactorRequired: false,
    })
    const expired = await call('POST', '/password-resets/token-check', {
      body: { token: TOKENS.expired },
    })
    expect(problemName(expired)).toBe('invalid-reset-token')
    const weak = await call('POST', '/password-resets/completion', {
      body: { token: TOKENS.totp, newPassword: 'x' },
    })
    expect(weak.status).toBe(422)
    const factor = await call('POST', '/password-resets/completion', {
      body: { token: TOKENS.totp, newPassword: 'summer2026x' },
    })
    expect(problemName(factor)).toBe('second-factor-required')
    expect(factor.body.methods[0].type).toBe('totp')
    const wrong = await call('POST', '/password-resets/completion', {
      body: {
        token: TOKENS.totp,
        newPassword: 'summer2026x',
        secondFactor: { type: 'totp', methodId: 11, code: '000000' },
      },
    })
    expect(problemName(wrong)).toBe('second-factor-failed')
    const done = await call('POST', '/password-resets/completion', {
      body: {
        token: TOKENS.totp,
        newPassword: 'summer2026x',
        secondFactor: { type: 'totp', methodId: 11, code: '123456' },
      },
    })
    expect(done.body.data.address).toBe('alice@example.org')
    const again = await call('POST', '/password-resets/token-check', {
      body: { token: TOKENS.totp },
    })
    expect(problemName(again)).toBe('invalid-reset-token')
    const unsupported = await call('POST', '/password-resets/completion', {
      body: { token: TOKENS.unsupported, newPassword: 'summer2026x' },
    })
    expect(problemName(unsupported)).toBe('second-factor-unavailable')
  })

  it('ends this browser’s session when it is signed in as the account', async () => {
    useScenario('account-password-reset-signed-in')
    const done = await call('POST', '/password-resets/completion', {
      body: { token: '333333-ANNA00-333333-333333-333333', newPassword: 'summer2026x' },
    })
    expect(done.status).toBe(200)
    expect((await call('GET', '/session')).body.data.state).toBe('anonymous')
  })
})
