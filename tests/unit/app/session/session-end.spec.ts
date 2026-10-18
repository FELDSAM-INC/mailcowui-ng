// Session end, sign-out and cross-tab coherence (FR-034, FR-036, FR-037, research R11, R12).
import { flushPromises } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { effectScope } from 'vue'

import { ApiProblem, clearCsrfToken, createQueryClient, queryKeys, type Identity } from '@/api'
import { usePreferencesStore } from '@/app/preferences/store'
import { installGuards } from '@/app/router/guards'
import { installSession } from '@/app/session'
import { connectCrossTab } from '@/app/session/cross-tab'
import { identityQuery, sessionQuery } from '@/app/session/queries'
import { endSession, type SessionContext } from '@/app/session/session-end'
import { signOut, useSignOut } from '@/app/session/sign-out'
import { useSessionStore } from '@/app/session/store'
import { createAppChannel } from '@/shared/platform/broadcast'

import { mockState, server, useScenario } from '../../../mocks/node'
import { installBroadcastChannel } from '../../support/broadcast'
import { createTestRouter } from '../../support/router'

let tabs: ReturnType<typeof installBroadcastChannel>

beforeEach(() => {
  clearCsrfToken()
  tabs = installBroadcastChannel()
})

afterEach(() => {
  clearCsrfToken()
})

async function signedInAt(path: string, account = 'admin'): Promise<SessionContext> {
  useScenario('anonymous-default', { signedInAs: account })
  const queryClient = createQueryClient({ retryDelay: 0 })
  const router = createTestRouter()
  installGuards(router, { queryClient })
  const ctx: SessionContext = { queryClient, router, channel: createAppChannel() }
  await router.push(path)
  await queryClient.fetchQuery(identityQuery())
  queryClient.setQueryData(['passkeys', 'list', { limit: 25 }], { data: [], meta: {} })
  return ctx
}

const tokenFetches = () => mockState().requests.filter((r) => r.operationId === 'getCsrfToken')

describe('session end (FR-034)', () => {
  it('clears the cache, keeps the page for later and shows sign-in with a notice', async () => {
    const ctx = await signedInAt('/domains?x=1')
    const before = tokenFetches().length
    await endSession(ctx)
    const store = useSessionStore()
    expect(ctx.queryClient.getQueryData(queryKeys.identity())).toBeUndefined()
    expect(ctx.queryClient.getQueryData(['passkeys', 'list', { limit: 25 }])).toBeUndefined()
    expect(ctx.queryClient.getQueryData(queryKeys.session())).toMatchObject({ state: 'anonymous' })
    expect(store.notice).toBe('sessionEnded')
    expect(store.returnTo).toBe('/domains?x=1')
    expect(ctx.router.currentRoute.value.name).toBe('sign-in')
    expect(ctx.router.currentRoute.value.query).toEqual({ returnTo: '/domains?x=1' })
    expect(tokenFetches().length).toBe(before + 1)
  })

  it('runs once when several requests report the end at the same time', async () => {
    const ctx = await signedInAt('/domains')
    const before = tokenFetches().length
    await Promise.all([endSession(ctx), endSession(ctx), endSession(ctx)])
    expect(tokenFetches().length).toBe(before + 1)
  })

  it('tells the other tabs when it was a local idle expiry', async () => {
    const ctx = await signedInAt('/domains')
    const other = tabs.remote()
    await endSession(ctx, { broadcast: true })
    expect(other.received).toContainEqual({ v: 1, type: 'signed-out' })
  })
})

describe('sign-out (FR-036)', () => {
  it('clears everything, tells the other tabs and fetches a new token', async () => {
    const ctx = await signedInAt('/domains')
    const other = tabs.remote()
    const store = useSessionStore()
    store.keptUsername = 'admin'
    const result = await signOut(ctx)
    expect(result).toEqual({ ok: true })
    expect(mockState().requests.some((r) => r.operationId === 'deleteSession')).toBe(true)
    expect(ctx.queryClient.getQueryData(queryKeys.identity())).toBeUndefined()
    expect(store.keptUsername).toBeNull()
    expect(store.notice).toBe('signedOut')
    expect(other.received).toContainEqual({ v: 1, type: 'signed-out' })
    expect(ctx.router.currentRoute.value.name).toBe('sign-in')
    const last = mockState().requests.at(-1)
    expect(last?.operationId).toBe('getCsrfToken')
  })

  it('keeps the state and offers a retry when the server cannot be reached', async () => {
    const ctx = await signedInAt('/domains')
    server.use(http.delete('*/api/v2/session', () => HttpResponse.error()))
    const scope = effectScope()
    const signOutState = scope.run(() => useSignOut(ctx))!
    await signOutState.signOut()
    expect(signOutState.failed.value).toMatchObject({ kind: 'network' })
    expect(ctx.queryClient.getQueryData(queryKeys.identity())).toBeDefined()
    expect(ctx.router.currentRoute.value.name).toBe('placeholder-domains')
    expect(useSessionStore().notice).toBeNull()
    server.resetHandlers()
    await signOutState.retry()
    expect(signOutState.failed.value).toBeNull()
    expect(ctx.router.currentRoute.value.name).toBe('sign-in')
    scope.stop()
  })
})

describe('cross-tab coherence (FR-037)', () => {
  it('records activity from another tab', async () => {
    const ctx = await signedInAt('/domains')
    const stop = connectCrossTab(ctx)
    const store = useSessionStore()
    store.idleWarningOpen = true
    tabs.remote().channel.postMessage({ v: 1, type: 'activity', at: 4_102_444_800_000 })
    expect(store.lastActivityAt).toBe(4_102_444_800_000)
    expect(store.idleWarningOpen).toBe(false)
    stop()
  })

  it('clears the cache and refetches after session-changed', async () => {
    const ctx = await signedInAt('/domains')
    const stop = connectCrossTab(ctx)
    const identityFetches = () =>
      mockState().requests.filter((r) => r.operationId === 'getIdentity').length
    // Another tab signed in as someone else.
    useScenario('anonymous-default', { signedInAs: 'reseller' })
    const before = identityFetches()
    tabs.remote().channel.postMessage({ v: 1, type: 'session-changed' })
    await flushPromises()
    await waitUntil(
      () => ctx.queryClient.getQueryData<Identity>(queryKeys.identity())?.username === 'reseller',
    )
    expect(ctx.queryClient.getQueryData(['passkeys', 'list', { limit: 25 }])).toBeUndefined()
    expect(identityFetches()).toBeGreaterThan(before)
    stop()
  })

  it('ends the session when another tab signed out', async () => {
    const ctx = await signedInAt('/domains')
    const stop = connectCrossTab(ctx)
    tabs.remote().channel.postMessage({ v: 1, type: 'signed-out' })
    await waitUntil(() => ctx.router.currentRoute.value.name === 'sign-in')
    expect(useSessionStore().notice).toBe('sessionEnded')
    expect(ctx.queryClient.getQueryData(queryKeys.identity())).toBeUndefined()
    stop()
  })

  it('clears the cache when an identity refresh reports another account', async () => {
    const ctx = await signedInAt('/domains')
    const stop = connectCrossTab(ctx)
    useScenario('anonymous-default', { signedInAs: 'reseller' })
    await ctx.queryClient.fetchQuery({ ...identityQuery(), staleTime: 0 })
    await flushPromises()
    expect(ctx.queryClient.getQueryData(['passkeys', 'list', { limit: 25 }])).toBeUndefined()
    expect((ctx.queryClient.getQueryData(queryKeys.identity()) as Identity).username).toBe(
      'reseller',
    )
    await waitUntil(() => !!ctx.queryClient.getQueryData(queryKeys.session()))
    expect(ctx.queryClient.getQueryState(sessionQuery().queryKey)?.status).toBe('success')
    stop()
  })

  it('keeps the cache when an identity refresh reports the same account', async () => {
    const ctx = await signedInAt('/domains')
    const stop = connectCrossTab(ctx)
    await ctx.queryClient.fetchQuery({ ...identityQuery(), staleTime: 0 })
    expect(ctx.queryClient.getQueryData(['passkeys', 'list', { limit: 25 }])).toBeDefined()
    stop()
  })
})

async function waitUntil(condition: () => boolean, timeout = 2000): Promise<void> {
  const started = Date.now()
  while (!condition()) {
    if (Date.now() - started > timeout) throw new Error('condition not met')
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

describe('session wiring', () => {
  it('ends the session when a query reports unauthenticated', async () => {
    const ctx = await signedInAt('/domains')
    const uninstall = installSession(ctx)
    useScenario('anonymous-default')
    await ctx.queryClient.fetchQuery({ ...identityQuery(), staleTime: 0 }).catch(() => undefined)
    await waitUntil(() => ctx.router.currentRoute.value.name === 'sign-in')
    expect(useSessionStore().notice).toBe('sessionEnded')
    uninstall()
  })

  it('ends the session on the client signal of a refused token replay', async () => {
    const ctx = await signedInAt('/domains')
    const uninstall = installSession(ctx)
    server.use(
      http.delete('*/api/v2/session', () =>
        HttpResponse.json(
          {
            type: '/api/v2/problems/csrf-token-mismatch',
            title: 'x',
            status: 403,
            requestId: 'a'.repeat(32),
          },
          { status: 403, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    await signOut(ctx)
    await waitUntil(() => useSessionStore().notice === 'sessionEnded')
    uninstall()
  })

  it('refreshes the identity after forbidden and follows pending actions', async () => {
    const ctx = await signedInAt('/domains', 'reseller')
    const uninstall = installSession(ctx)
    const failing = (status: number, type: string, extra: Record<string, unknown> = {}) =>
      ctx.queryClient
        .fetchQuery({
          queryKey: ['test', type],
          queryFn: () =>
            Promise.reject(
              ApiProblem.fromParts({
                kind: 'problem',
                status,
                type: `/api/v2/problems/${type}`,
                ...extra,
              }),
            ),
          retry: false,
        })
        .catch(() => undefined)
    await failing(403, 'forbidden')
    expect(ctx.queryClient.getQueryState(queryKeys.identity())?.isInvalidated).toBe(true)
    useScenario('anonymous-default', { signedInAs: 'bob@example.org' })
    await failing(403, 'pending-action-required')
    await waitUntil(() => ctx.router.currentRoute.value.name === 'pending-actions')
    uninstall()
  })

  it('mirrors the idle lifetime and the session state', async () => {
    const ctx = await signedInAt('/domains')
    const uninstall = installSession(ctx)
    useScenario('anonymous-default', { signedInAs: 'admin', idleTimeout: 150 })
    await ctx.queryClient.fetchQuery({ ...sessionQuery(), staleTime: 0 })
    expect(useSessionStore().idleTimeout).toBe(150)
    expect(usePreferencesStore().canSave.theme).toBe(true)
    uninstall()
  })
})
