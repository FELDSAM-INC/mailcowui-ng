// UI 006 (T017, research R18): the shared locale number field.
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import LocaleNumberField from '@/shared/components/LocaleNumberField.vue'

import { mountWithApp } from '../../support/mount'

describe('LocaleNumberField', () => {
  it('is a text field with a decimal keypad, autocorrect off and its label', () => {
    const wrapper = mountWithApp(LocaleNumberField, {
      props: { id: 'junk', label: 'Junk folder from', modelValue: 65 },
    })
    const input = wrapper.get('input')
    expect(input.attributes('type')).toBe('text')
    expect(input.attributes('inputmode')).toBe('decimal')
    expect(input.attributes('autocorrect')).toBe('off')
    expect(input.attributes('autocapitalize')).toBe('off')
    expect(wrapper.get('label').attributes('for')).toBe('junk')
    expect(input.attributes('id')).toBe('junk')
    expect((input.element as HTMLInputElement).value).toBe('6.5')
  })

  it('shows the stored value in the locale without grouping', () => {
    i18n.global.locale.value = 'cs-cz'
    const wrapper = mountWithApp(LocaleNumberField, {
      props: { id: 'max', label: 'Max', modelValue: 12345, mode: 'decimal' },
    })
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('1234,5')
    i18n.global.locale.value = 'en-gb'
  })

  it('emits tenths for a valid entry', async () => {
    i18n.global.locale.value = 'cs-cz'
    const wrapper = mountWithApp(LocaleNumberField, {
      props: { id: 'junk', label: 'Junk', modelValue: null, optional: true },
    })
    await wrapper.get('input').setValue('6,5')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([65])
    expect(wrapper.emitted('update:valid')?.at(-1)).toEqual([true])
    i18n.global.locale.value = 'en-gb'
  })

  it('emits a whole number in integer mode with a numeric keypad', async () => {
    const wrapper = mountWithApp(LocaleNumberField, {
      props: { id: 'n', label: 'Messages', modelValue: null, mode: 'integer', optional: true },
    })
    expect(wrapper.get('input').attributes('inputmode')).toBe('numeric')
    await wrapper.get('input').setValue(' 100 ')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([100])
  })

  it('shows the reason of an invalid entry with aria-invalid and keeps the model', async () => {
    const wrapper = mountWithApp(LocaleNumberField, {
      props: { id: 'junk', label: 'Junk', modelValue: 80 },
    })
    await wrapper.get('input').setValue('8,5')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('update:valid')?.at(-1)).toEqual([false])
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true')
    expect(wrapper.text()).toContain('8,5')
    await wrapper.get('input').setValue('8.55')
    expect(wrapper.text()).toContain('0.1')
    await wrapper.get('input').setValue('')
    expect(wrapper.text()).toContain('This field is required.')
  })

  it('shows external errors after its own and follows an outside value', async () => {
    const wrapper = mountWithApp(LocaleNumberField, {
      props: { id: 'r', label: 'Reject', modelValue: 150, errors: ['Too high'] },
    })
    expect(wrapper.text()).toContain('Too high')
    await wrapper.setProps({ modelValue: 101 })
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('10.1')
  })
})
