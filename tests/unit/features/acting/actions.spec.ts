import { expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent } from 'vue'
import { queryKeys, type Identity } from '@/api'
import { beginActing, returnFromActing } from '@/features/acting/actions'
import { setSessionContext } from '@/app/session/context'
import { signOut } from '@/app/session/sign-out'
import { useSessionStore } from '@/app/session/store'
import {
  identityQuery,
  sessionQuery,
  useIdentityQuery,
  useSessionQuery,
} from '@/app/session/queries'
import { mountWithApp, testPlugins } from '../../support/mount'
import { mockState, useScenario } from '../../../mocks/node'

async function setup() {
  useScenario('acting-admin')
  const { queryClient } = testPlugins()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: {} },
      { path: '/mailboxes', name: 'mailboxes', component: {} },
      { path: '/account/password', name: 'account-password', component: {} },
      { path: '/account/overview', name: 'account-overview', component: {} },
    ],
  })
  await router.push('/mailboxes?q=alice&page=2')
  await queryClient.fetchQuery(identityQuery())
  await queryClient.fetchQuery(sessionQuery())
  const channel = { post: vi.fn(), subscribe: vi.fn(() => () => {}), close: vi.fn() }
  setSessionContext({ queryClient, router, channel })
  return { queryClient, router, channel }
}
it('captures the initiating route before the request, clears private caches and returns to it', async () => {
  const { queryClient, router } = await setup()
  queryClient.setQueryData(['private-admin-list'], ['private'])
  mockState().delays.startImpersonation = 40
  const request = beginActing(
    { kind: 'mailboxUser', address: 'alice@example.org', domain: 'example.org' },
    router.currentRoute.value.fullPath,
  )
  await router.push('/account/password')
  await request
  expect(useSessionStore().actingOrigin).toBe('/mailboxes?q=alice&page=2')
  expect(queryClient.getQueryData(['private-admin-list'])).toBeUndefined()
  expect(
    JSON.stringify(
      queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.state.data),
    ),
  ).not.toContain(mockState().session.csrfToken)
  expect(queryClient.getMutationCache().getAll()).toHaveLength(0)
  expect(queryClient.getQueryData<Identity>(queryKeys.identity())?.username).toBe(
    'alice@example.org',
  )
  expect(router.currentRoute.value.fullPath).toBe('/account/overview')
  await returnFromActing()
  expect(router.currentRoute.value.fullPath).toBe('/mailboxes?q=alice&page=2')
  expect(queryClient.getQueryData<Identity>(queryKeys.identity())?.username).toBe('admin')
  expect(useSessionStore().actingOrigin).toBeNull()
  setSessionContext(null)
})
it('keeps the original identity and route when the API refuses the start', async () => {
  const { queryClient, router } = await setup()
  await expect(
    beginActing({ kind: 'domainAdmin', username: 'missing' }, router.currentRoute.value.fullPath),
  ).rejects.toMatchObject({ status: 404 })
  expect(queryClient.getQueryData<Identity>(queryKeys.identity())?.username).toBe('admin')
  expect(router.currentRoute.value.fullPath).toBe('/mailboxes?q=alice&page=2')
  expect(useSessionStore().actingOrigin).toBeNull()
  setSessionContext(null)
})
it('rebinds mounted shell observers after clearing the old identity cache', async () => {
  await setup()
  const ShellIdentity = defineComponent({
    setup: () => ({ identity: useIdentityQuery(), session: useSessionQuery() }),
    template:
      '<div>{{ identity.data.value?.username }} {{ session.data.value?.impersonation?.target.username }}</div>',
  })
  const wrapper = mountWithApp(ShellIdentity)
  expect(wrapper.text()).toBe('admin')
  await beginActing(
    { kind: 'mailboxUser', address: 'alice@example.org', domain: 'example.org' },
    '/mailboxes?q=alice',
  )
  await vi.waitFor(() => expect(wrapper.text()).toBe('alice@example.org alice@example.org'))
  await returnFromActing()
  await vi.waitFor(() => expect(wrapper.text()).toBe('admin'))
  wrapper.unmount()
  setSessionContext(null)
})
it('removes acting session metadata from mounted app observers on complete sign-out', async () => {
  const ctx = await setup()
  await beginActing(
    { kind: 'mailboxUser', address: 'alice@example.org', domain: 'example.org' },
    '/mailboxes',
  )
  const wrapper = mountWithApp(
    defineComponent({
      setup: () => ({ session: useSessionQuery() }),
      template:
        '<div>{{ session.data.value?.state }} {{ session.data.value?.impersonation?.target.username }}</div>',
    }),
  )
  expect(wrapper.text()).toBe('active alice@example.org')
  expect(await signOut(ctx)).toEqual({ ok: true })
  await vi.waitFor(() => expect(wrapper.text()).toBe('anonymous'))
  wrapper.unmount()
  setSessionContext(null)
})
