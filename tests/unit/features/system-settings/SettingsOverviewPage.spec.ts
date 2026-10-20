import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { i18n, loadFeatureMessages, loadLegacy, lt } from '@/i18n'
import SettingsOverviewPage from '@/features/system-settings/pages/SettingsOverviewPage.vue'
import { settingsPages } from '@/features/system-settings/catalogue'
import { settingsCapabilities } from '../../../mocks/factories/settings'
import { mockState } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((stop) => stop())
  vi.useRealTimers()
})
async function setup(query = '') {
  await loadFeatureMessages('system-settings')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/system', component: { render: () => null } },
      ...settingsPages.map((page) => ({
        path: `/target/${page.id}`,
        name: page.routeName,
        component: { render: () => null },
      })),
      { path: '/effective', name: 'rspamd-effective-map', component: { render: () => null } },
    ],
  })
  await router.push({ path: '/system', query: { q: query || undefined } })
  const wrapper = mountWithApp(SettingsOverviewPage, {
    attachTo: document.body,
    props: { capabilities: settingsCapabilities() },
    global: { plugins: [router] },
  })
  cleanups.push(() => wrapper.unmount())
  return { wrapper, router }
}

describe('settings overview search', () => {
  it('updates results immediately, delays only the announcement, and does not read saved settings', async () => {
    const { wrapper, router } = await setup()
    const baseline = mockState().requests.length
    vi.useFakeTimers()
    await wrapper.get('#settings-search').setValue('sender')
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()
    expect(router.currentRoute.value.query.q).toBe('sender')
    expect(wrapper.findAll('[data-settings-results] a').length).toBeGreaterThan(0)
    expect(wrapper.get('[data-settings-search-count]').text()).toBe('')
    await vi.advanceTimersByTimeAsync(500)
    expect(wrapper.get('[data-settings-search-count]').text()).toMatch(/matching pages?$/)
    expect(mockState().requests).toHaveLength(baseline)
  })
  it('restores q with Back and clears an empty result without losing focus', async () => {
    const { wrapper, router } = await setup('impossible-needle')
    expect(wrapper.get('[data-settings-search-empty]').text()).toContain('No matching settings')
    await wrapper.get('[data-settings-search-empty] button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.q).toBeUndefined()
    expect(document.activeElement?.id).toBe('settings-search')
    await router.push('/system?q=sender')
    await router.push('/target/ip-check')
    router.back()
    await vi.waitFor(() => expect(router.currentRoute.value.query.q).toBe('sender'))
    expect(wrapper.get<HTMLInputElement>('#settings-search').element.value).toBe('sender')
  })
  it('rebuilds capability and locale dependent entries while keeping English legacy names searchable', async () => {
    const { wrapper, router } = await setup('license')
    expect(wrapper.findAll('[data-settings-results] a')).toHaveLength(1)
    await wrapper.setProps({
      capabilities: settingsCapabilities({ licenseVerificationEnabled: false }),
    })
    expect(wrapper.findAll('[data-settings-results] a')).toHaveLength(0)
    await loadFeatureMessages('system-settings', i18n, 'cs-cz')
    await loadLegacy('cs-cz')
    i18n.global.locale.value = 'cs-cz'
    await router.replace('/system?q=Customize')
    await flushPromises()
    expect(wrapper.findAll('[data-settings-results] a').length).toBeGreaterThan(1)
    expect(wrapper.get('[data-settings-results]').text()).toContain(lt('admin.ui_texts'))
    await router.replace('/system?q=System%20mails')
    await flushPromises()
    expect(wrapper.get('[data-settings-results]').text()).toContain(lt('admin.sys_mails'))
  })
})
