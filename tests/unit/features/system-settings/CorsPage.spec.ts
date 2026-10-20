import { expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { loadFeatureMessages } from '@/i18n'
import CorsPage from '@/features/system-settings/pages/integrations/CorsPage.vue'
import { settingsCapabilities } from '../../../mocks/factories/settings'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'
async function setup(scenario = 'settings-admin-defaults') {
  useScenario(scenario)
  await loadFeatureMessages('system-settings')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: CorsPage, props: { capabilities: settingsCapabilities() } },
      { path: '/system', name: 'system-settings', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mountWithApp(RouterView, { global: { plugins: [router] } })
  await vi.waitFor(() => expect(wrapper.find('[data-cors-value]').exists()).toBe(true))
  await wrapper.get('button').trigger('click')
  return wrapper
}
it('uses the exact legacy controls/order and saves normalized origins with If-Match', async () => {
  const wrapper = await setup()
  expect(wrapper.findAll('select option').map((o) => o.text())).toEqual([
    'POST',
    'GET',
    'DELETE',
    'PUT',
  ])
  await wrapper
    .get('textarea')
    .setValue('HTTPS://PORTAL.EXAMPLE.ORG; https://portal.example.org\n*')
  await wrapper.get('select').setValue(['POST', 'GET'])
  await wrapper.get('form').trigger('submit')
  await vi.waitFor(() =>
    expect(mockState().settings.cors.allowedOrigins).toEqual(['https://portal.example.org', '*']),
  )
  const request = mockState().requests.find((r) => r.operationId === 'updateLegacyApiCorsSettings')!
  expect(request.headers['if-match']).toBe('"cors-1"')
  expect(wrapper.text()).toContain('CORS settings have been saved')
})
it('shows stored invalid origins and refuses even a methods-only change until corrected', async () => {
  const wrapper = await setup('cors-legacy-bare-host')
  expect(wrapper.text()).toContain('Invalid Allow-Origin specified')
  await wrapper.get('select').setValue(['POST'])
  await wrapper.get('form').trigger('submit')
  expect(mockState().requests.some((r) => r.operationId === 'updateLegacyApiCorsSettings')).toBe(
    false,
  )
  expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('old.example.org')
})
