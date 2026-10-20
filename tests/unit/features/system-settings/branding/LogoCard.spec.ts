import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LogoCard from '@/features/system-settings/components/branding/LogoCard.vue'
import { loadFeatureMessages } from '@/i18n'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'
import { settingsCapabilities } from '../../../../mocks/factories/settings'
import { useScenario } from '../../../../mocks/node'
import { mountWithApp } from '../../../support/mount'

beforeEach(async () => {
  await loadFeatureMessages('system-settings')
})
describe('Logo details and reset confirmation (T055)', () => {
  it('shows stored metadata, previews the current image in confirmation, and cancels safely', async () => {
    useScenario('branding-light-logo')
    const wrapper = mountWithApp(LogoCard, {
      props: { variant: 'light', capabilities: settingsCapabilities() },
    })
    await vi.waitFor(() => expect(wrapper.text()).toContain('image/png'))
    expect(wrapper.text()).toContain('300 × 80')
    await wrapper.get('[data-logo-reset]').trigger('click')
    await flushPromises()
    expect(confirmState.value?.description).toContain('Normal')
    expect(confirmState.value?.description).toContain('default')
    expect(confirmState.value?.content?.props?.src).toContain('/public-config/logos/light')
    settleConfirm(false)
    await flushPromises()
    expect(wrapper.text()).toContain('image/png')
    wrapper.unmount()
  })
  it('makes demo mode read-only with the server reason', async () => {
    useScenario('settings-demo-mode')
    const wrapper = mountWithApp(LogoCard, {
      props: { variant: 'light', capabilities: settingsCapabilities({ demoMode: true }) },
    })
    await vi.waitFor(() => expect(wrapper.find('[data-logo-reset]').exists()).toBe(true))
    expect(wrapper.get('[data-logo-reset]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('input[type=file]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Demo Mode is enabled')
    wrapper.unmount()
  })
})
