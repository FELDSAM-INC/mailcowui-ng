import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import VerificationCodeInput from '@/shared/components/VerificationCodeInput.vue'

function mountCode(value = '') {
  return mount(
    defineComponent({
      components: { VerificationCodeInput },
      data: () => ({ code: value }),
      template: '<label for="code">Code</label><VerificationCodeInput id="code" v-model="code" />',
    }),
    { attachTo: document.body },
  )
}

describe('VerificationCodeInput', () => {
  it('keeps one labelled autofill control and displays six digit boxes', async () => {
    const wrapper = mountCode()
    const input = wrapper.get('input')
    expect(input.attributes()).toMatchObject({
      id: 'code',
      inputmode: 'numeric',
      autocomplete: 'one-time-code',
    })
    expect(wrapper.findAll('input')).toHaveLength(1)
    expect(wrapper.findAll('[data-code-digit]')).toHaveLength(6)
    await input.setValue('012 345')
    expect(wrapper.vm.code).toBe('012345')
    expect(wrapper.findAll('[data-code-digit]').map((digit) => digit.text())).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
    ])
    wrapper.unmount()
  })

  it('limits entry to six digits and clears every box with its model', async () => {
    const wrapper = mountCode()
    await wrapper.get('input').setValue('a12b3456789')
    expect(wrapper.vm.code).toBe('123456')
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('123456')
    await wrapper.setData({ code: '' })
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('')
    expect(wrapper.findAll('[data-code-digit]').every((digit) => digit.text() === '')).toBe(true)
    wrapper.unmount()
  })

  it('forwards validation descriptions to the actual textbox and reflects its error state', () => {
    const wrapper = mount(VerificationCodeInput, {
      props: { modelValue: '' },
      attrs: { id: 'code', 'aria-invalid': 'true', 'aria-describedby': 'code-error' },
    })
    expect(wrapper.get('input').attributes()).toMatchObject({
      'aria-invalid': 'true',
      'aria-describedby': 'code-error',
    })
    expect(wrapper.get('[data-code-input]').attributes('data-invalid')).toBe('true')
    wrapper.unmount()
  })
})
