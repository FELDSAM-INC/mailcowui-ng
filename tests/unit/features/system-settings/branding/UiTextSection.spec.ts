import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UiTextSection from '@/features/system-settings/components/branding/UiTextSection.vue'
import { loadFeatureMessages } from '@/i18n'
import { brandingState } from '../../../../mocks/scenarios/settings-branding'
import { settingsCapabilities } from '../../../../mocks/factories/settings'
import { useScenario } from '../../../../mocks/node'
import { mountWithApp } from '../../../support/mount'

beforeEach(() => loadFeatureMessages('system-settings'))
describe('UI text sections', () => {
  it('saves only this section’s changed names and uses the returned version', async () => {
    const state = useScenario('ui-texts-custom')
    const wrapper = mountWithApp(UiTextSection, {
      props: {
        sectionId: 'names',
        resource: structuredClone(brandingState(state).texts),
        capabilities: settingsCapabilities(),
      },
    })
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('#ui-text-productName-description').text()).toContain('Leave empty')
    await wrapper.get('#ui-text-productName').setValue('Acme & Co Mail')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(brandingState(state).texts.productName).toBe('Acme & Co Mail'))
    await flushPromises()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(state.publicConfig.productName).toBe('Acme & Co Mail')
    expect(brandingState(state).texts.pageTitle).toBe('Custom title')
    wrapper.unmount()
  })
  it('keeps multiple invalid fields and presents an error summary', async () => {
    const state = useScenario('ui-texts-custom')
    const wrapper = mountWithApp(UiTextSection, {
      props: {
        sectionId: 'names',
        resource: structuredClone(brandingState(state).texts),
        capabilities: settingsCapabilities(),
      },
    })
    await wrapper.get('button').trigger('click')
    await wrapper.get('#ui-text-productName').setValue('x'.repeat(256))
    await wrapper.get('#ui-text-pageTitle').setValue('y'.repeat(256))
    await wrapper.get('form').trigger('submit')
    expect(wrapper.findAll('[aria-invalid="true"]')).toHaveLength(2)
    expect(wrapper.findAll('a[href^="#ui-text-"]')).toHaveLength(2)
    expect(brandingState(state).texts.productName).toBe('Custom Mail')
    wrapper.unmount()
  })
})
