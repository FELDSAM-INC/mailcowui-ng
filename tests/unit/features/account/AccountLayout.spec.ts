// My account's frame and hub (UI 005 T023, FR-001, FR-002, FR-006, research R4): "no access" in
// place with the address kept and no section request, the capabilities error with "Try again", the
// optional classic reason, only registered sections on the hub in the classic order, and the
// section navigation beside the content from `lg` up.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { setSessionContext } from '@/app/session/context'
import AccountHomePage from '@/features/account/pages/AccountHomePage.vue'
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
      { path: '/passkeys', name: 'passkeys', component: Section },
      {
        path: '/account',
        component: AccountLayout,
        meta: { layout: 'shell', access: 'session', navEntry: 'account' },
        children: [
          { path: '', name: 'account', component: AccountHomePage },
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

  it('keeps the section navigation beside the content from lg up', async () => {
    installMatchMedia({ '(min-width: 1024px)': true })
    useScenario('account-mailbox')
    const { wrapper } = await mountAt('/account/password')
    await vi.waitFor(() =>
      expect(wrapper.find('[data-section-nav] [aria-current="page"]').text()).toBe(
        'Change password',
      ),
    )
  })

  it('has no section navigation below lg', async () => {
    useScenario('account-mailbox')
    const { wrapper } = await mountAt('/account/password')
    await flushPromises()
    expect(wrapper.find('[data-section-nav]').exists()).toBe(false)
  })
})

describe('AccountHomePage', () => {
  it('lists only the registered sections the account may open, in the classic order', async () => {
    useScenario('account-mailbox')
    const { wrapper } = await mountAt('/account')
    await vi.waitFor(() => expect(wrapper.findAll('[data-section]').length).toBeGreaterThan(0))
    expect(
      wrapper.findAll('[data-section]').map((item) => item.attributes('data-section')),
    ).toEqual(['mailApps', 'password', 'passkeys', 'appPasswords'])
    expect(wrapper.find('h1').text()).toBe('User Settings')
  })

  it('leaves out sections the account may not use', async () => {
    useScenario('account-admin')
    const { wrapper } = await mountAt('/account')
    await vi.waitFor(() => expect(wrapper.findAll('[data-section]').length).toBeGreaterThan(0))
    expect(
      wrapper.findAll('[data-section]').map((item) => item.attributes('data-section')),
    ).toEqual(['password', 'passkeys'])
  })
})
