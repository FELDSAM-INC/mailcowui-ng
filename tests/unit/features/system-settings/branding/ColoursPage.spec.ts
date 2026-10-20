import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import ColoursPage from '@/features/system-settings/pages/branding/ColoursPage.vue'
import { queryKeys } from '@/api'
import { loadFeatureMessages } from '@/i18n'
import { useScenario } from '../../../../mocks/node'
import { brandingState } from '../../../../mocks/scenarios/settings-branding'
import { settingsCapabilities } from '../../../../mocks/factories/settings'
import { mountWithApp, testPlugins } from '../../../support/mount'

async function setup(demoMode = false) {
  const state = useScenario('brand-colours-none')
  await loadFeatureMessages('system-settings')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/',
        component: ColoursPage,
        props: { capabilities: settingsCapabilities({ demoMode }) },
      },
      { path: '/audit-log', name: 'audit-log', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mountWithApp(RouterView, { global: { plugins: [router] } })
  await vi.waitFor(() => expect(wrapper.find('#section-brand-colours').exists()).toBe(true))
  return { wrapper, state }
}

describe('Colours page', () => {
  it('saves only changed colours and refreshes the public configuration', async () => {
    const { wrapper, state } = await setup()
    testPlugins().queryClient.setQueryData(queryKeys.publicConfig(), {})
    await wrapper.get('#section-brand-colours button').trigger('click')
    await wrapper.get('#brand-colour-light').setValue('1D4ED8')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(brandingState(state).colours.light).toBe('#1d4ed8'))
    expect(brandingState(state).colours.dark).toBeNull()
    expect(testPlugins().queryClient.getQueryState(queryKeys.publicConfig())?.isInvalidated).toBe(
      true,
    )
    wrapper.unmount()
  })
  it('treats invalid text as an unsaved draft and never submits it as a clear', async () => {
    const { wrapper, state } = await setup()
    await wrapper.get('#section-brand-colours button').trigger('click')
    await wrapper.get('#brand-colour-light').setValue('#abc')
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
    await wrapper.get('form').trigger('submit')
    expect(brandingState(state).colours.etag).toBe('"brand-colours-1"')
    expect(wrapper.get('#brand-colour-light').attributes('aria-invalid')).toBe('true')
    wrapper.unmount()
  })
  it('keeps demo values readable without opening an edit form', async () => {
    const { wrapper } = await setup(true)
    expect(wrapper.find('#section-brand-colours button').exists()).toBe(false)
    expect(wrapper.get('[data-demo-mode]').text()).toContain('Demo Mode')
    wrapper.unmount()
  })
})
