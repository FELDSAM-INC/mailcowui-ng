import { http, HttpResponse } from 'msw'
import { expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import {
  api,
  createQueryClient,
  queryKeys,
  refreshCsrfToken,
  requireData,
  setSessionReactions,
  type Identity,
} from '@/api'
import { setSessionContext } from '@/app/session/context'
import { switchIdentity } from '@/app/session/identity-switch'
import { identityQuery, sessionQuery } from '@/app/session/queries'
import { endSession } from '@/app/session/session-end'
import { signOut } from '@/app/session/sign-out'
import { updateAlias } from '@/features/aliases/api'
import { acceptSession, createSession } from '@/features/auth/api'
import { MOCK_PASSWORD } from '../../../mocks/scenarios/accounts'

import { server, useScenario } from '../../../mocks/node'
import { alias } from '../../features/aliases/alias-fixture'

async function context() {
  useScenario('admin-active')
  await refreshCsrfToken()
  const queryClient = createQueryClient({ retryDelay: 0 })
  await queryClient.fetchQuery(identityQuery())
  await queryClient.fetchQuery(sessionQuery())
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: {} },
      { path: '/domains', name: 'domains', component: {}, meta: { navEntry: 'domains' } },
      { path: '/sign-in', name: 'sign-in', component: {} },
    ],
  })
  await router.push('/domains')
  return {
    queryClient,
    router,
    channel: { post: vi.fn(), subscribe: vi.fn(() => () => {}), close: vi.fn() },
  }
}

it('does not let a delayed anonymous401 end a newly accepted sign-in', async () => {
  const ctx = await context()
  await endSession(ctx)
  setSessionContext(ctx)
  const unauthenticated = vi.fn()
  setSessionReactions({
    unauthenticated,
    forbidden: vi.fn(),
    secondFactorRequired: vi.fn(),
    pendingActionRequired: vi.fn(),
  })
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const received = vi.fn()
  server.use(
    http.get(
      '*/api/v2/me',
      async () => {
        received()
        await pending
        return HttpResponse.json(
          { type: '/api/v2/problems/unauthenticated', status: 401 },
          {
            status: 401,
            headers: { 'Content-Type': 'application/problem+json' },
          },
        )
      },
      { once: true },
    ),
  )
  try {
    const old = ctx.queryClient
      .fetchQuery({
        queryKey: ['anonymous-check'],
        queryFn: () => api.GET('/me').then(requireData),
        retry: false,
      })
      .catch((error: unknown) => error)
    await vi.waitFor(() => expect(received).toHaveBeenCalledOnce())
    await acceptSession(await createSession({ username: 'admin', password: MOCK_PASSWORD }))
    release()
    expect(await old).toMatchObject({ kind: 'identityChanged' })
    expect(unauthenticated).not.toHaveBeenCalled()
    expect(ctx.queryClient.getQueryData<Identity>(queryKeys.identity())?.username).toBe('admin')
  } finally {
    release()
    setSessionContext(null)
    setSessionReactions(null)
  }
})

it.each(['switch', 'sign-out', 'session-end'])(
  'discards an actual alias PATCH response after %s and never repopulates private data',
  async (transition) => {
    const ctx = await context()
    let release!: () => void
    const response = new Promise<void>((resolve) => {
      release = resolve
    })
    const received = vi.fn()
    server.use(
      http.patch('*/api/v2/aliases/7', async () => {
        received()
        await response
        return HttpResponse.json({
          data: alias({ privateComment: 'previous-account-private-note' }),
        })
      }),
    )
    const redirect = vi.fn()
    const save = updateAlias(
      ctx.queryClient,
      7,
      { privateComment: 'previous-account-private-note' },
      '"a1"',
    )
      .then(redirect)
      .catch((error: unknown) => error)
    await vi.waitFor(() => expect(received).toHaveBeenCalledOnce())

    if (transition === 'switch') {
      const identity = {
        ...ctx.queryClient.getQueryData<Identity>(queryKeys.identity())!,
        username: 'replacement-account',
      }
      await switchIdentity({ reason: 'changedInAnotherTab', identity, csrfToken: 'new-token' }, ctx)
      expect(ctx.queryClient.getQueryData<Identity>(queryKeys.identity())?.username).toBe(
        'replacement-account',
      )
    } else if (transition === 'sign-out') {
      expect(await signOut(ctx)).toEqual({ ok: true })
    } else await endSession(ctx)

    release()
    expect(await save).toMatchObject({ kind: 'identityChanged' })
    expect(redirect).not.toHaveBeenCalled()
    expect(ctx.queryClient.getQueryData(queryKeys.aliases.detail(7))).toBeUndefined()
    expect(
      JSON.stringify(
        ctx.queryClient
          .getQueryCache()
          .getAll()
          .map((query) => query.state.data),
      ),
    ).not.toContain('previous-account-private-note')
  },
)

it('keeps pending writes usable when sign-out fails and the original session remains', async () => {
  const ctx = await context()
  let release!: () => void
  const response = new Promise<void>((resolve) => {
    release = resolve
  })
  const received = vi.fn()
  server.use(
    http.delete('*/api/v2/session', () => HttpResponse.error()),
    http.patch('*/api/v2/aliases/7', async () => {
      received()
      await response
      return HttpResponse.json({ data: alias({ privateComment: 'saved' }) })
    }),
  )
  const save = updateAlias(ctx.queryClient, 7, { privateComment: 'saved' }, '"a1"')
  await vi.waitFor(() => expect(received).toHaveBeenCalledOnce())
  expect(await signOut(ctx)).toMatchObject({ ok: false })
  release()
  expect(await save).toMatchObject({ privateComment: 'saved' })
  expect(ctx.queryClient.getQueryData(queryKeys.aliases.detail(7))).toMatchObject({
    privateComment: 'saved',
  })
})
