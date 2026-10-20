import { mount } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { expect, it, vi } from 'vitest'
import { defineComponent, h, onUnmounted, nextTick, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createQueryClient, currentCsrfToken, queryKeys, type Identity } from '@/api'
import { switchIdentity, retryIdentitySwitch } from '@/app/session/identity-switch'
import { useSessionStore } from '@/app/session/store'
import { identityQuery, sessionQuery } from '@/app/session/queries'
import { liveMessages } from '@/shared/composables/useAnnouncer'
import { lt } from '@/i18n'
import { drafts } from '@/shared/composables/draft-registry'
import { confirm, confirmState } from '@/shared/composables/useConfirm'
import { endSession } from '@/app/session/session-end'
import { mockState, server, useScenario } from '../../../mocks/node'

async function context(path = '/domains?q=old') {
  useScenario('admin-active')
  const queryClient = createQueryClient({ retryDelay: 0 })
  await queryClient.fetchQuery(identityQuery())
  await queryClient.fetchQuery(sessionQuery())
  queryClient.setQueryData(['private', 'previous-user'], 'must disappear')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: {} },
      { path: '/domains', name: 'domains', component: {}, meta: { navEntry: 'domains' } },
      {
        path: '/private-admin',
        name: 'private-admin',
        component: {},
        meta: { navEntry: 'administrators' },
      },
      {
        path: '/administrators/admins/:username',
        name: 'admin-detail',
        component: {},
        meta: { navEntry: 'administrators' },
      },
      { path: '/sign-in', name: 'sign-in', component: {}, meta: { layout: 'auth' } },
    ],
  })
  await router.push(path)
  const channel = { post: vi.fn(), subscribe: vi.fn(() => () => {}), close: vi.fn() }
  return { queryClient, router, channel }
}
it('unmounts before cancellation/cache clearing, adopts supplied identity and token, and discards drafts', async () => {
  const ctx = await context()
  const store = useSessionStore()
  const steps: string[] = []
  const Page = defineComponent({
    setup() {
      onUnmounted(() => steps.push('unmount'))
      return () => h('p', 'old data')
    },
  })
  const wrapper = mount(
    defineComponent({
      setup: () => () => (store.identityTransition ? h('p', 'switching') : h(Page)),
    }),
  )
  const cancel = vi.spyOn(ctx.queryClient, 'cancelQueries').mockImplementation(() => {
    steps.push('cancel')
    return Promise.resolve()
  })
  const clear = vi.spyOn(ctx.queryClient, 'clear')
  drafts.set('old', { owner: 'admin', value: 'private draft' })
  const identity = {
    ...ctx.queryClient.getQueryData<Identity>(queryKeys.identity())!,
    username: 'reseller',
    role: 'domainAdmin' as const,
  }
  await switchIdentity({ reason: 'actingStarted', identity, csrfToken: 'new-token' }, ctx)
  expect(steps).toEqual(['unmount', 'cancel'])
  expect(cancel).toHaveBeenCalledOnce()
  expect(clear).toHaveBeenCalledOnce()
  expect(ctx.queryClient.getQueryData(['private', 'previous-user'])).toBeUndefined()
  expect(drafts.size).toBe(0)
  expect(currentCsrfToken()).toBe('new-token')
  expect(ctx.queryClient.getQueryData(queryKeys.identity())).toEqual(identity)
  expect(store.actingOrigin).toBe('/domains?q=old')
  expect(store.identityTransition).toBe(false)
  expect(ctx.router.currentRoute.value.name).toBe('home')
  expect(ctx.channel.post).toHaveBeenCalledWith({ v: 1, type: 'session-changed' })
  wrapper.unmount()
})
it('returns to the original query when acting ends and clears the memory-only origin', async () => {
  const ctx = await context('/')
  useSessionStore().actingOrigin = '/domains?q=old&page=2'
  await switchIdentity({ reason: 'actingEnded' }, ctx)
  expect(ctx.router.currentRoute.value.fullPath).toBe('/domains?q=old&page=2')
  expect(useSessionStore().actingOrigin).toBeNull()
  expect(mockState().requests.some((r) => r.operationId === 'getCsrfToken')).toBe(true)
})
it('keeps a permitted route on another-tab switch, otherwise goes home, and does not rebroadcast', async () => {
  const ctx = await context('/private-admin')
  useScenario('anonymous-default', { signedInAs: 'reseller' })
  await switchIdentity({ reason: 'changedInAnotherTab', refusedWrite: true }, ctx)
  expect(ctx.router.currentRoute.value.name).toBe('home')
  expect(ctx.channel.post).not.toHaveBeenCalled()
  expect(useSessionStore().shellNotice).toMatchObject({
    key: 'acting.notice.changedInAnotherTab',
    refusedWrite: true,
  })
})
it.each(['csrf-token', 'me', 'session'])(
  'keeps the transition screen after a failed %s read and retries without old data',
  async (endpoint) => {
    const ctx = await context()
    server.use(http.get(`*/api/v2/${endpoint}`, () => HttpResponse.error()))
    await switchIdentity({ reason: 'changedInAnotherTab' }, ctx)
    expect(useSessionStore().identityTransition).toBe(true)
    expect(useSessionStore().identityTransitionProblem).toMatchObject({ kind: 'network' })
    expect(ctx.queryClient.getQueryData(['private', 'previous-user'])).toBeUndefined()
    server.resetHandlers()
    await retryIdentitySwitch()
    expect(useSessionStore().identityTransition).toBe(false)
    expect(useSessionStore().identityTransitionProblem).toBeNull()
  },
)
it('routes self rename to the new account detail', async () => {
  const ctx = await context()
  const identity = {
    ...ctx.queryClient.getQueryData<Identity>(queryKeys.identity())!,
    username: 'renamed',
  }
  await switchIdentity({ reason: 'selfRenamed', identity }, ctx)
  expect(ctx.router.currentRoute.value.params.username).toBe('renamed')
  await vi.waitFor(() => expect(liveMessages.polite.value).toBe(lt('success.admin_modified')))
})

it('focuses the newly mounted heading even when another-tab switch keeps the same route', async () => {
  const ctx = await context()
  const store = useSessionStore()
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(
          'main',
          store.identityTransition ? h('p', 'switching') : h('h1', { tabindex: -1 }, 'New page'),
        ),
    }),
    { attachTo: document.body },
  )
  await switchIdentity({ reason: 'changedInAnotherTab' }, ctx)
  expect(document.activeElement).toBe(wrapper.get('h1').element)
  wrapper.unmount()
})
it('focuses the heading when the new page finishes loading after the cache clear', async () => {
  const ctx = await context()
  const store = useSessionStore()
  const ready = ref(false)
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(
          'main',
          { tabindex: -1 },
          store.identityTransition || !ready.value ? h('p', 'Loading') : h('h1', 'Loaded account'),
        ),
    }),
    { attachTo: document.body },
  )
  await switchIdentity({ reason: 'selfRenamed' }, ctx)
  expect(document.activeElement).toBe(wrapper.get('main').element)
  ready.value = true
  await vi.waitFor(() => expect(document.activeElement).toBe(wrapper.get('h1').element))
  wrapper.unmount()
})
it('cancels an open confirmation before changing identity', async () => {
  const ctx = await context()
  const choice = confirm({ title: 'Remove account', confirmLabel: 'Remove' })
  const switching = switchIdentity({ reason: 'changedInAnotherTab' }, ctx)
  expect(await choice).toBe(false)
  expect(confirmState.value).toBeNull()
  await switching
})
it('returns server-ended acting to its origin and explains that the last action did not run', async () => {
  const ctx = await context('/')
  useSessionStore().actingOrigin = '/domains?q=restored&page=3'
  await switchIdentity({ reason: 'actingEndedByServer' }, ctx)
  expect(ctx.router.currentRoute.value.fullPath).toBe('/domains?q=restored&page=3')
  expect(useSessionStore().shellNotice).toEqual({
    key: 'acting.notice.endedByServer',
    refusedWrite: true,
  })
  expect(ctx.channel.post).toHaveBeenCalledWith({ v: 1, type: 'session-changed' })
})
it('lands a replaced session at its validated requested address', async () => {
  const ctx = await context('/sign-in')
  useSessionStore().returnTo = '/domains?q=after-sign-in'
  await switchIdentity({ reason: 'sessionReplaced' }, ctx)
  expect(ctx.router.currentRoute.value.fullPath).toBe('/domains?q=after-sign-in')
  expect(useSessionStore().returnTo).toBeNull()
})
it('shares a simultaneous switch and fetches one fresh token', async () => {
  const ctx = await context()
  const before = mockState().requests.filter((r) => r.operationId === 'getCsrfToken').length
  const first = switchIdentity({ reason: 'changedInAnotherTab' }, ctx)
  const second = switchIdentity({ reason: 'changedInAnotherTab' }, ctx)
  expect(second).toBe(first)
  await Promise.all([first, second])
  expect(mockState().requests.filter((r) => r.operationId === 'getCsrfToken')).toHaveLength(
    before + 1,
  )
})
it('ends the session when the new identity is no longer signed in', async () => {
  const ctx = await context()
  useScenario('anonymous-default')
  await switchIdentity({ reason: 'actingEnded' }, ctx)
  expect(ctx.router.currentRoute.value.name).toBe('sign-in')
  expect(useSessionStore().identityTransition).toBe(false)
  expect(useSessionStore().notice).toBe('sessionEnded')
  expect(ctx.queryClient.getQueryData(queryKeys.identity())).toBeUndefined()
})
it('does not restore a late identity when the session ends during the switch', async () => {
  const ctx = await context()
  const identity = ctx.queryClient.getQueryData<Identity>(queryKeys.identity())!
  let release!: () => void
  let started = false
  const response = new Promise<void>((resolve) => {
    release = resolve
  })
  server.use(
    http.get('*/api/v2/me', async () => {
      started = true
      await response
      return HttpResponse.json({ data: identity })
    }),
  )
  const switching = switchIdentity({ reason: 'changedInAnotherTab' }, ctx)
  await vi.waitFor(() => expect(started).toBe(true))
  await endSession(ctx)
  release()
  await switching
  await nextTick()
  expect(ctx.queryClient.getQueryData(queryKeys.identity())).toBeUndefined()
  expect(ctx.router.currentRoute.value.name).toBe('sign-in')
  expect(useSessionStore().shellNotice).toBeNull()
})
