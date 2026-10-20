// My account's frame and hub (UI 005 T023, FR-001, FR-002, FR-006, research R4): "no access" in
// place with the address kept and no section request, the capabilities error with "Try again", the
// optional classic reason, only registered sections on the hub in the classic order, and the
// shared section navigation above full-width content on every viewport.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { setSessionContext } from '@/app/session/context'
import AccountLayout from '@/features/account/components/layout/AccountLayout.vue'
import { createAppChannel } from '@/shared/platform/broadcast'

import { mockState, useScenario } from '../../../mocks/node'
import { installMatchMedia } from '../../support/media'
import { mountWithApp, testPlugins } from '../../support/mount'

const Section = defineComponent({
  name: 'SectionStub',
  setup: () => () => h('h1', { 'data-section-page': '' }, 'section page'),
})

afterEach(() => setSessionContext(null))

function router() {
  return createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [
      { path: '/', name: 'home', component: Section },
      {
        path: '/account',
        component: AccountLayout,
        meta: { layout: 'shell', access: 'session', navEntry: 'account' },
        children: [
          { path: '', name: 'account', redirect: { name: 'account-password' } },
          {
            path: '/passkeys',
            name: 'passkeys',
            component: Section,
            meta: { accountSection: 'passkeys' },
          },
          {
            path: 'password',
            name: 'account-password',
            component: Section,
            meta: { accountSection: 'password' },
          },
          {
            path: 'mail-apps',
            name: 'account-mail-apps',
            component: Section,
            meta: { accountSection: 'mailApps' },
          },
          {
            path: 'app-passwords',
            name: 'account-app-passwords',
            component: Section,
            meta: { accountSection: 'appPasswords' },
          },
        ],
      },
    ],
  })
}

async function mountAt(path: string) {
  const r = router()
  await r.push(path)
  setSessionContext({
    queryClient: testPlugins().queryClient,
    router: r,
    channel: createAppChannel('t'),
  })
  const wrapper = mountWithApp(defineComponent({ setup: () => () => h(RouterView) }), {
    global: { plugins: [r] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router: r }
}

describe('AccountLayout', () => {
  it('shows "no access" with the classic reason in place, keeping the address (FR-006, FR-106)', async () => {
    useScenario('account-admin')
    const { wrapper, router } = await mountAt('/account/mail-apps')
    await vi.waitFor(() => expect(wrapper.text()).toContain('No access'))
    expect(wrapper.text()).toContain(
      'Please login as mailbox user to download the requested Apple connection profile.',
    )
    expect(wrapper.find('[data-section-page]').exists()).toBe(false)
    expect(router.currentRoute.value.fullPath).toBe('/account/mail-apps')
  })

  it('shows "no access" for a section whose flag is off, without the section request', async () => {
    useScenario('account-mailbox-no-flags')
    const { wrapper } = await mountAt('/account/app-passwords')
    await vi.waitFor(() => expect(wrapper.text()).toContain('No access'))
    expect(wrapper.find('[data-section-page]').exists()).toBe(false)
    expect(mockState().requests.some((r) => r.operationId === 'listAppPasswords')).toBe(false)
  })

  it('shows the error state with "Try again" when the capabilities cannot be read', async () => {
    useScenario('account-capabilities-unavailable')
    const { wrapper } = await mountAt('/account/password')
    await vi.waitFor(() => expect(wrapper.text()).toContain('This item could not be loaded.'))
    const retry = wrapper.findAll('button').find((button) => button.text() === 'Try again')
    expect(retry).toBeTruthy()
    mockState().failures = {}
    await retry!.trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-section-page]').exists()).toBe(true))
  })

  it('renders a visible section', async () => {
    useScenario('account-mailbox')
    const { wrapper } = await mountAt('/account/password')
    await vi.waitFor(() => expect(wrapper.find('[data-section-page]').exists()).toBe(true))
  })

  it.each([false, true])('places section navigation above the content (wide=%s)', async (wide) => {
    installMatchMedia({ '(min-width: 1024px)': wide })
    useScenario('account-mailbox')
    const { wrapper, router } = await mountAt('/account/password')
    await vi.waitFor(() => expect(wrapper.find('[data-section-page]').exists()).toBe(true))
    const navigation = wrapper.get('[data-section-nav]')
    expect(navigation.attributes('data-section-navigation')).toBeDefined()
    expect(navigation.get('[aria-current="page"]').text()).toBe('Change password')
    expect(wrapper.find('aside').exists()).toBe(false)
    expect(navigation.element.parentElement).toBe(
      wrapper.get('[data-account-content]').element.parentElement,
    )
    expect(navigation.get('button').attributes('aria-expanded')).toBe('false')
    await navigation.get('button').trigger('click')
    expect(navigation.get('button').attributes('aria-expanded')).toBe('true')
    await navigation.get('a[href="/ng/account/app-passwords"]').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('account-app-passwords'))
    expect(navigation.get('[aria-current="page"]').text()).toBe('App passwords')
    expect(navigation.get('button').attributes('aria-expanded')).toBe('false')
  })

  it('offers only permitted account sections in the shared navigation', async () => {
    useScenario('account-admin')
    const { wrapper } = await mountAt('/account/password')
    await vi.waitFor(() => expect(wrapper.find('[data-section-page]').exists()).toBe(true))
    expect(wrapper.findAll('[data-section-nav] a').map((link) => link.attributes('href'))).toEqual([
      '/ng/account/password',
      '/ng/passkeys',
    ])
  })
})

describe('account entry points', () => {
  it('opens Password directly instead of the removed overview', async () => {
    useScenario('account-admin')
    const { wrapper, router } = await mountAt('/account')
    await vi.waitFor(() => expect(wrapper.find('[data-section-page]').exists()).toBe(true))
    expect(router.currentRoute.value.name).toBe('account-password')
    expect(wrapper.get('[data-section-nav] [aria-current="page"]').text()).toBe('Change password')
    expect(wrapper.find('[data-sections]').exists()).toBe(false)
  })

  it('keeps the same account navigation above Passkeys', async () => {
    useScenario('account-admin')
    const { wrapper, router } = await mountAt('/passkeys')
    await vi.waitFor(() => expect(wrapper.find('[data-section-page]').exists()).toBe(true))
    const nav = wrapper.get('[data-section-nav]')
    expect(nav.get('[aria-current="page"]').text()).toBe('Passkeys')
    await nav.get('a[href="/ng/account/password"]').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('account-password'))
  })
})
