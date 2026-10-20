import { flushPromises } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { loadFeatureMessages } from '@/i18n'
import LicensePage from '@/features/system-settings/pages/integrations/LicensePage.vue'
import { settingsCapabilities } from '../../../mocks/factories/settings'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'
async function setup(scenario = 'settings-license-valid', enabled = true) {
  useScenario(scenario)
  await loadFeatureMessages('system-settings')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/',
        component: LicensePage,
        props: { capabilities: settingsCapabilities({ licenseVerificationEnabled: enabled }) },
      },
      { path: '/system', name: 'system-settings', component: { template: '<div />' } },
      { path: '/home', name: 'home', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  await router.isReady()
  return mountWithApp(RouterView, { global: { plugins: [router] } })
}
it('never reads or verifies a disabled license', async () => {
  const wrapper = await setup('settings-license-disabled', false)
  await flushPromises()
  expect(wrapper.text()).toContain('Page not found')
  expect(
    mockState().requests.some((r) =>
      ['getLicenseStatus', 'verifyLicense'].includes(r.operationId ?? ''),
    ),
  ).toBe(false)
})
it('verifies only on explicit action and treats unreachable as a result', async () => {
  const wrapper = await setup('settings-license-unreachable')
  await vi.waitFor(() => expect(wrapper.find('[data-license-result]').exists()).toBe(true))
  expect(mockState().requests.some((r) => r.operationId === 'verifyLicense')).toBe(false)
  expect(wrapper.text()).toContain('Only the GUID')
  await wrapper.get('[data-verify-license]').trigger('click')
  await vi.waitFor(() =>
    expect(wrapper.get('[data-license-result]').text()).toContain('unreachable'),
  )
  expect(wrapper.find('[role=alert]').exists()).toBe(false)
})
