import { http, HttpResponse } from 'msw'
import { expect, it, vi } from 'vitest'
import { createQueryClient, queryKeys, type Identity } from '@/api'
import { connectCrossTab } from '@/app/session/cross-tab'
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
it('keeps cache observers when another tab lifts a restriction for the same identity', async () => {
  const ctx = await setup()
  const clear = vi.spyOn(ctx.queryClient, 'clear')
  const before = mockState().requests.filter((r) => r.operationId === 'getIdentity').length
  ctx.receive({ v: 1, type: 'session-changed' })
  await vi.waitFor(() =>
    expect(
      mockState().requests.filter((r) => r.operationId === 'getIdentity').length,
    ).toBeGreaterThan(before),
  )
  expect(clear).not.toHaveBeenCalled()
  expect(ctx.queryClient.getQueryData(['private'])).toBe('old data')
  expect(useSessionStore().shellNotice).toBeNull()
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
