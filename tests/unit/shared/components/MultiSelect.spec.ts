import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import MultiSelect from '@/shared/components/MultiSelect.vue'
import { mountWithApp } from '../../support/mount'

describe('shared multiselect', () => {
  it('toggles a choice without replacing the other selected values', async () => {
    const wrapper = mountWithApp(MultiSelect, {
      props: {
        id: 'protocols',
        label: 'Protocols',
        modelValue: ['imap'],
        options: [
          { value: 'imap', label: 'IMAP' },
          { value: 'smtp', label: 'SMTP' },
        ],
      },
      attachTo: document.body,
    })
    expect(wrapper.get('button').attributes('id')).toBe('protocols')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    const smtp = document.querySelector<HTMLElement>('[data-multiselect-option="smtp"]')!
    smtp.click()
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['imap', 'smtp']])
    wrapper.unmount()
  })
  it('cannot open or change disabled choices', async () => {
    const wrapper = mountWithApp(MultiSelect, {
      props: {
        id: 'acl',
        label: 'ACL',
        modelValue: [],
        options: [{ value: 'login', label: 'Login' }],
        disabled: true,
      },
    })
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
