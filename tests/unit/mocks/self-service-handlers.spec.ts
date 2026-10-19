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
