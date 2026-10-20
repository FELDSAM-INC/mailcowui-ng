import { expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { queryKeys } from '@/api'
import { startImpersonation } from '@/features/acting/api'
import AccountLayout from '@/features/account/components/layout/AccountLayout.vue'
import PasskeysPage from '@/features/passkeys/pages/PasskeysPage.vue'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'

it.each(['password', 'twoFactor', 'recoveryEmail'] as const)(
  'replaces %s credential forms with an acting explanation before mounting their fields',
  async (section) => {
    useScenario('acting-admin')
    const result = await startImpersonation({ role: 'mailboxUser', username: 'alice@example.org' })
    testPlugins().queryClient.setQueryData(queryKeys.identity(), result.identity)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: {}, meta: { accountSection: section } }],
    })
    await router.push('/')
    const wrapper = mountWithApp(AccountLayout, {
      global: {
        plugins: [router],
        stubs: { SectionNav: true, RouterView: { template: '<input type="password" />' } },
      },
    })
    await vi.waitFor(() =>
      expect(wrapper.text()).toContain('Not available while acting as another user'),
    )
    expect(wrapper.find('input[type="password"]').exists()).toBe(false)
  },
)

it('does not request or expose passkey management while acting', async () => {
  useScenario('acting-admin')
  const result = await startImpersonation({ role: 'mailboxUser', username: 'alice@example.org' })
  testPlugins().queryClient.setQueryData(queryKeys.identity(), result.identity)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/passkeys', component: {} }],
  })
  await router.push('/passkeys')
  const wrapper = mountWithApp(PasskeysPage, { global: { plugins: [router] } })
  await vi.waitFor(() =>
    expect(wrapper.text()).toContain('Not available while acting as another user'),
  )
  expect(wrapper.find('form').exists()).toBe(false)
  expect(
    mockState().requests.some((request) => request.path.startsWith('/api/v2/me/passkeys')),
  ).toBe(false)
})
