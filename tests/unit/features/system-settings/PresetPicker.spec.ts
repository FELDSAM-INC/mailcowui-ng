import { describe, expect, it, vi } from 'vitest'
import { loadFeatureMessages } from '@/i18n'
import PresetPicker from '@/features/system-settings/components/spam/PresetPicker.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'
import { useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

describe('PresetPicker (T109)', () => {
  it('translates known keys, uses unknown headline fallback, and confirms replacement', async () => {
    useScenario('settings-admin-defaults')
    await loadFeatureMessages('system-settings')
    const wrapper = mountWithApp(PresetPicker, { props: { kind: 'rspamd', replace: true } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Disable Rspamd for a domain'))
    expect(wrapper.text()).toContain('Operator example')
    expect(wrapper.text()).not.toContain('admin.rsettings_preset_999')
    const button = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Disable Rspamd for a domain'))!
    await button.trigger('click')
    expect(confirmState.value).not.toBeNull()
    expect(wrapper.emitted('select')).toBeUndefined()
    settleConfirm(false)
    await Promise.resolve()
    expect(wrapper.emitted('select')).toBeUndefined()
    await button.trigger('click')
    settleConfirm(true)
    await vi.waitFor(() =>
      expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({ id: 'preset_4' }),
    )
  })
  it('offers all eight Sieve examples to a domain administrator', async () => {
    useScenario('settings-domain-admin')
    await loadFeatureMessages('system-settings')
    const wrapper = mountWithApp(PresetPicker, { props: { kind: 'sieve', replace: false } })
    await vi.waitFor(() => expect(wrapper.findAll('[data-preset]')).toHaveLength(8))
    await wrapper.get('[data-preset="sieve_8"] button').trigger('click')
    expect(confirmState.value).toBeNull()
    expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({ id: 'sieve_8' })
  })
  it('does not insert a preset after the picker has unmounted while confirming', async () => {
    useScenario('settings-admin-defaults')
    await loadFeatureMessages('system-settings')
    const wrapper = mountWithApp(PresetPicker, { props: { kind: 'rspamd', replace: true } })
    await vi.waitFor(() => expect(wrapper.find('[data-preset="preset_4"]').exists()).toBe(true))
    await wrapper.get('[data-preset="preset_4"] button').trigger('click')
    wrapper.unmount()
    settleConfirm(true)
    await Promise.resolve()
    expect(wrapper.emitted('select')).toBeUndefined()
  })
})
