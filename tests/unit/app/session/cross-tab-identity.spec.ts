import { http, HttpResponse } from 'msw'
import { expect, it, vi } from 'vitest'
import { createQueryClient, queryKeys, type Identity } from '@/api'
import { connectCrossTab, refreshAfterSessionChange } from '@/app/session/cross-tab'
import { installGuards } from '@/app/router/guards'
import { identityQuery, sessionQuery } from '@/app/session/queries'
import { useSessionStore } from '@/app/session/store'
import type { AppMessage } from '@/shared/platform/broadcast'
import { mockState, server, useScenario } from '../../../mocks/node'
import { createTestRouter } from '../../support/router'
async function setup() {
  useScenario('admin-active')
  const queryClient = createQueryClient({ retryDelay: 0 })
  await queryClient.fetchQuery(identityQuery())
  await queryClient.fetchQuery(sessionQuery())
  queryClient.setQueryData(['private'], 'old data')
  const router = createTestRouter()
  await router.push('/domains?q=keep')
  let receive: (message: AppMessage) => void = () => {}
  const channel = {
    post: vi.fn(),
    subscribe: (listener: typeof receive) => {
      receive = listener
      return () => {}
    },
    close: () => {},
  }
  const stop = connectCrossTab({ queryClient, router, channel })
  return { queryClient, router, channel, stop, receive: (message: AppMessage) => receive(message) }
}
async function signedOutContext() {
  useScenario('anonymous-default')
  const queryClient = createQueryClient({ retryDelay: 0 })
  const session = await queryClient.fetchQuery(sessionQuery())
  const router = createTestRouter()
  installGuards(router, { queryClient })
  await router.push('/sign-in?returnTo=/domains')
  const channel = { post: vi.fn(), subscribe: vi.fn(() => () => {}), close: vi.fn() }
  return { queryClient, router, channel, session }
}
it('refreshes an anonymous session without an identity request or resetting its observers', async () => {
  const { queryClient, router, channel, session } = await signedOutContext()
  const clear = vi.spyOn(queryClient, 'clear')
  const originalQuery = queryClient.getQueryCache().find({ queryKey: queryKeys.session() })
  const reads = mockState().requests.filter((r) => r.operationId === 'getSession').length

  await refreshAfterSessionChange({ queryClient, router, channel })

  expect(mockState().requests.filter((r) => r.operationId === 'getSession')).toHaveLength(reads + 1)
  expect(mockState().requests.some((r) => r.operationId === 'getIdentity')).toBe(false)
  expect(queryClient.getQueryData(queryKeys.session())).toEqual(session)
  expect(queryClient.getQueryCache().find({ queryKey: queryKeys.session() })).toBe(originalQuery)
  expect(clear).not.toHaveBeenCalled()
  expect(router.currentRoute.value.fullPath).toBe('/sign-in?returnTo=/domains')
  expect(useSessionStore().notice).toBeNull()
})
it('follows a second-factor step from another tab without requesting an identity', async () => {
  const ctx = await signedOutContext()
  mockState().session.state = 'pendingSecondFactor'
  mockState().session.pendingSignIn = {
    username: 'alice@example.org',
    role: 'mailboxUser',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  }

  await refreshAfterSessionChange(ctx)

  expect(ctx.queryClient.getQueryData(queryKeys.session())).toMatchObject({
    state: 'pendingSecondFactor',
  })
  expect(ctx.router.currentRoute.value.name).toBe('sign-in-second-factor')
  expect(ctx.router.currentRoute.value.query.returnTo).toBe('/domains')
  expect(mockState().requests.some((r) => r.operationId === 'getIdentity')).toBe(false)
})
it.each([
  ['admin', 'active', '/domains'],
  ['bob@example.org', 'restricted', '/pending-actions'],
] as const)(
  'adopts a %s sign-in from another tab through the identity transition',
  async (username, state, path) => {
    const ctx = await signedOutContext()
    Object.assign(mockState().session, {
      state,
      username,
      authMethod: 'password',
      signedInAt: new Date().toISOString(),
    })

    await refreshAfterSessionChange(ctx)

    expect(ctx.queryClient.getQueryData(queryKeys.identity())).toMatchObject({ username })
    expect(ctx.queryClient.getQueryData(queryKeys.session())).toMatchObject({ state })
    expect(ctx.router.currentRoute.value.path).toBe(path)
    expect(useSessionStore().identityTransition).toBe(false)
    expect(ctx.channel.post).not.toHaveBeenCalled()
  },
)
it('keeps cache observers when another tab lifts a restriction for the same identity', async () => {
  const ctx = await setup()
  const clear = vi.spyOn(ctx.queryClient, 'clear')
  const before = mockState().requests.filter((r) => r.operationId === 'getIdentity').length
  await refreshAfterSessionChange(ctx)
  expect(
    mockState().requests.filter((r) => r.operationId === 'getIdentity').length,
  ).toBeGreaterThan(before)
  expect(clear).not.toHaveBeenCalled()
  expect(ctx.queryClient.getQueryData(['private'])).toBe('old data')
  expect(useSessionStore().shellNotice).toBeNull()
  ctx.stop()
})
it('leaves the same protected URL when a changed identity has a required action', async () => {
  const ctx = await setup()
  await ctx.router.push('/account/password')
  installGuards(ctx.router, { queryClient: ctx.queryClient })
  Object.assign(mockState().session, {
    state: 'restricted',
    username: 'bob@example.org',
    authMethod: 'password',
    signedInAt: new Date().toISOString(),
  })

  await refreshAfterSessionChange(ctx)

  expect(ctx.router.currentRoute.value.path).toBe('/pending-actions')
  expect(ctx.router.currentRoute.value.query.returnTo).toBe('/account/password')
  expect(ctx.queryClient.getQueryData(['private'])).toBeUndefined()
  expect(ctx.queryClient.getQueryData(queryKeys.identity())).toMatchObject({
    username: 'bob@example.org',
  })
  ctx.stop()
})
it('uses the identity switch when only the acting instance changed and does not broadcast again', async () => {
  const ctx = await setup()
  const old = ctx.queryClient.getQueryData<Identity>(queryKeys.identity())!
  const next = { ...old, impersonation: { id: 'new-instance' } } as Identity
  server.use(http.get('*/api/v2/me', () => HttpResponse.json({ data: next })))
  ctx.receive({ v: 1, type: 'session-changed' })
  await vi.waitFor(() =>
    expect(useSessionStore().shellNotice?.key).toBe('acting.notice.changedInAnotherTab'),
  )
  expect(ctx.queryClient.getQueryData(['private'])).toBeUndefined()
  expect(ctx.router.currentRoute.value.fullPath).toBe('/domains?q=keep')
  expect(
    ctx.channel.post.mock.calls.filter(([message]) => message.type === 'session-changed'),
  ).toHaveLength(0)
  ctx.stop()
})
it('an ordinary identity refresh detects a new acting instance, while focus causes no request', async () => {
  const ctx = await setup()
  const before = mockState().requests.length
  window.dispatchEvent(new Event('focus'))
  document.dispatchEvent(new Event('visibilitychange'))
  expect(mockState().requests).toHaveLength(before)
  const identity = ctx.queryClient.getQueryData<Identity>(queryKeys.identity())!
  ctx.queryClient.setQueryData(queryKeys.identity(), {
    ...identity,
    impersonation: { id: 'new-instance' },
  })
  await vi.waitFor(() =>
    expect(useSessionStore().shellNotice?.key).toBe('acting.notice.changedInAnotherTab'),
  )
  expect(ctx.queryClient.getQueryData(['private'])).toBeUndefined()
  ctx.stop()
})
