import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { loadFeatureMessages } from '@/i18n'
import IpCheckPage from '@/features/system-settings/pages/integrations/IpCheckPage.vue'
import { operationsKeys } from '@/features/operations/query-keys'

import { settingsCapabilities } from '../../../mocks/factories/settings'
import { useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'

async function setup(demoMode = false) {
  useScenario('settings-admin-defaults')
  await loadFeatureMessages('system-settings')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/',
        component: IpCheckPage,
        props: { capabilities: settingsCapabilities({ demoMode }) },
      },
      { path: '/system', name: 'system-settings', component: { template: '<div />' } },
      { path: '/dashboard', name: 'operations-dashboard', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mountWithApp(RouterView, { global: { plugins: [router] } })
  await vi.waitFor(() => expect(wrapper.find('[data-ip-check-value]').text()).toBe('No'))
  return wrapper
}

describe('IP check page', () => {
  it('retains the legacy HTML label and invalidates dashboard addresses after saving', async () => {
    const wrapper = await setup()
    const client = testPlugins().queryClient
    client.setQueryData(operationsKeys.monitoring.publicAddresses(), { stale: true })
    await wrapper.get('button').trigger('click')
    expect(wrapper.findAll('label strong').map((node) => node.text())).toEqual([
      'ipv4.mailcow.email',
      'ipv6.mailcow.email',
    ])
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[data-ip-check-value]').text()).toBe('Yes'))
    expect(client.getQueryState(operationsKeys.monitoring.publicAddresses())?.isInvalidated).toBe(
      true,
    )
    expect(wrapper.find('a[href="/dashboard"]').exists()).toBe(true)
  })
  it('keeps demo-mode values readable and offers no edit action', async () => {
    const wrapper = await setup(true)
    expect(wrapper.find('[data-demo-mode]').text()).toBe('Demo Mode is enabled')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('input').exists()).toBe(false)
  })
})
