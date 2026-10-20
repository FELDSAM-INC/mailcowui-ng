import { expect, it, vi } from 'vitest'
import {
  api,
  createQueryClient,
  requireData,
  setCsrfToken,
  setSessionReactions,
  reportSessionProblem,
} from '@/api'
import { startImpersonation, endImpersonation } from '@/features/acting/api'
import { mockState, useScenario } from '../../../mocks/node'

it('starts and ends a scoped acting session, renewing CSRF without caching its response', async () => {
  useScenario('acting-admin')
  const client = createQueryClient({ retryDelay: 0 })
  const result = await startImpersonation({ role: 'mailboxUser', username: 'alice@example.org' })
  expect(result.identity).toMatchObject({
    username: 'alice@example.org',
    role: 'mailboxUser',
    pendingActions: [],
  })
  expect(result.identity.impersonation?.impersonator.username).toBe('admin')
  expect(result.csrfToken.token).toBe(mockState().session.csrfToken)
  expect(client.getQueryCache().getAll()).toHaveLength(0)
  expect(client.getMutationCache().getAll()).toHaveLength(0)
  setCsrfToken(result.csrfToken.token)
  await endImpersonation()
  expect(requireData(await api.GET('/me')).data).toMatchObject({ username: 'admin', role: 'admin' })
  expect(mockState().session.impersonation).toBeUndefined()
})
it('rejects a nested start and a domain administrator outside their scope', async () => {
  useScenario('acting-admin')
  const result = await startImpersonation({ role: 'domainAdmin', username: 'reseller' })
  setCsrfToken(result.csrfToken.token)
  await expect(
    startImpersonation({ role: 'mailboxUser', username: 'alice@example.org' }),
  ).rejects.toMatchObject({ status: 409 })
})
it('refuses a scoped target that is absent or outside the domain administrator scope', async () => {
  useScenario('acting-reseller-login-as')
  await expect(
    startImpersonation({ role: 'mailboxUser', username: 'outside@elsewhere.example' }),
  ).rejects.toMatchObject({ status: 404 })
})
it('dispatches server-ended acting from a direct write exactly once without replay', async () => {
  useScenario('acting-admin')
  const started = await startImpersonation({ role: 'mailboxUser', username: 'alice@example.org' })
  setCsrfToken(started.csrfToken.token)
  const ended = vi.fn()
  setSessionReactions({
    impersonationEnded: ended,
    unauthenticated: vi.fn(),
    secondFactorRequired: vi.fn(),
    pendingActionRequired: vi.fn(),
    forbidden: vi.fn(),
  })
  mockState().invalidateImpersonation = true
  const failure: unknown = await api
    .PATCH('/me/preferences', {
      params: { header: { 'If-Match': '"pref-1"' } },
      headers: { 'Content-Type': 'application/merge-patch+json' },
      body: { theme: 'dark' },
    })
    .catch((error: unknown) => error)
  expect(failure).toMatchObject({ status: 403 })
  expect(ended).toHaveBeenCalledOnce()
  reportSessionProblem(failure)
  expect(ended).toHaveBeenCalledOnce()
  expect(
    mockState().requests.filter((request) => request.operationId === 'updatePreferences'),
  ).toHaveLength(1)
})

it('public branding requests cannot consume the server-ended session response', async () => {
  useScenario('acting-admin')
  const started = await startImpersonation({ role: 'mailboxUser', username: 'alice@example.org' })
  setCsrfToken(started.csrfToken.token)
  mockState().invalidateImpersonation = true
  expect((await api.GET('/public-config')).response.status).toBe(200)
  expect(
    (
      await api.GET('/public-config/logos/{variant}', {
        params: { path: { variant: 'dark' } },
        parseAs: 'blob',
      })
    ).response.status,
  ).toBe(200)
  expect(mockState().session.impersonation).toBeDefined()
  await expect(api.GET('/me')).rejects.toMatchObject({ status: 403 })
  expect(mockState().session.impersonation).toBeUndefined()
})

it.each(['admin', 'domainAdmin'] as const)(
  'uses the %s impersonator permission rules without inheriting target restrictions',
  async (role) => {
    useScenario(role === 'admin' ? 'acting-admin' : 'acting-reseller-login-as')
    const target = mockState().accounts.find((account) => account.username === 'alice@example.org')!
    target.permissions.spamAlias = false
    target.permissions.syncjobs = false
    const owner = mockState().accounts.find((account) => account.role === role)!
    owner.permissions.syncjobs = false
    const result = await startImpersonation({ role: 'mailboxUser', username: target.username })
    expect(result.identity.permissions.spamAlias).toBe(true)
    expect(result.identity.permissions.syncjobs).toBe(role === 'admin')
    expect(result.identity.permissions.loginAs).toBe(role === 'admin' || owner.permissions.loginAs)
  },
)
it('allows complete sign-out after the acting target has become invalid', async () => {
  useScenario('acting-admin')
  const started = await startImpersonation({ role: 'mailboxUser', username: 'alice@example.org' })
  setCsrfToken(started.csrfToken.token)
  mockState().invalidateImpersonation = true
  expect((await api.DELETE('/session')).response.status).toBe(204)
  expect(mockState().session.state).toBe('anonymous')
})
