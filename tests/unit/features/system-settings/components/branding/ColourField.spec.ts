import { beforeEach, describe, expect, it } from 'vitest'
import ColourField from '@/features/system-settings/components/branding/ColourField.vue'
import { loadFeatureMessages } from '@/i18n'
import { mountWithApp } from '../../../../support/mount'

beforeEach(() => loadFeatureMessages('system-settings'))
describe('ColourField', () => {
  it('normalises hex, synchronises the native picker, and clears to null', async () => {
    const wrapper = mountWithApp(ColourField, {
      props: {
        id: 'colour',
        label: 'Light colour',
        modelValue: null,
        surface: '#ffffff',
        minimum: 4.5,
      },
    })
    await wrapper.get('input[type=text]').setValue('1D4ED8')
    await wrapper.get('input[type=text]').trigger('blur')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['#1d4ed8'])
    await wrapper.setProps({ modelValue: '#1d4ed8' })
    expect(wrapper.get<HTMLInputElement>('input[type=color]').element.value).toBe('#1d4ed8')
    await wrapper.get<HTMLInputElement>('input[type=color]').setValue('#123456')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['#123456'])
    await wrapper.get('input[type=text]').setValue('')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
  })
  it('keeps invalid text visible and offers a passing adjustment only for valid failing colour', async () => {
    const wrapper = mountWithApp(ColourField, {
      props: {
        id: 'colour',
        label: 'Light colour',
        modelValue: '#abc',
        surface: '#ffffff',
        minimum: 4.5,
      },
    })
    expect(wrapper.get('input[type=text]').attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('[data-adjust-colour]').exists()).toBe(false)
    await wrapper.setProps({ modelValue: '#ffd700' })
    await wrapper.get('[data-adjust-colour]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatch(/^#[0-9a-f]{6}$/)
    await wrapper.setProps({ disabled: true })
    expect(wrapper.get('[data-adjust-colour]').attributes('disabled')).toBeDefined()
  })
})
