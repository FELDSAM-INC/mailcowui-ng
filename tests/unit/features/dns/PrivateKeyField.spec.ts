// The private key field (T080, research R11, FR-029, FR-076): no spell checking, auto-correction,
// auto-completion or capitalisation; the UTF-8 size against the server's limit; a file checked by
// size before it is read, and the file input reset afterwards.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PrivateKeyField from '@/features/dns/components/PrivateKeyField.vue'

import { mountWithApp } from '../../support/mount'

const mountField = (modelValue = '', maxBytes = 64) =>
  mountWithApp(PrivateKeyField, {
    props: { id: 'key', modelValue, maxBytes, minBits: 1024, maxBits: 8192, errors: [] },
  })

describe('PrivateKeyField', () => {
  it('turns off everything that could alter or store the key', () => {
    const textarea = mountField().get('textarea')
    expect(textarea.attributes()).toMatchObject({
      autocomplete: 'off',
      autocapitalize: 'none',
      autocorrect: 'off',
      spellcheck: 'false',
    })
  })

  it('names the bit range and counts UTF-8 bytes against the limit', async () => {
    const wrapper = mountField('ž'.repeat(40))
    expect(wrapper.text()).toContain('1,024')
    expect(wrapper.text()).toContain('8,192')
    expect(wrapper.text()).toContain('This text may be at most 64 B long.')
    await wrapper.setProps({ modelValue: 'a'.repeat(10) })
    expect(wrapper.text()).not.toContain('at most')
  })

  it('reads a file that fits and resets the file input', async () => {
    const wrapper = mountField()
    const input = wrapper.get('input[type="file"]')
    const file = new File(['-----BEGIN PRIVATE KEY-----\nabc\n'], 'key.pem', { type: 'text/plain' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      '-----BEGIN PRIVATE KEY-----\nabc\n',
    ])
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('refuses a file over the limit without reading it', async () => {
    const wrapper = mountField('', 10)
    const input = wrapper.get('input[type="file"]')
    const file = new File(['x'.repeat(100)], 'big.pem')
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.text()).toContain('at most 10 B')
  })
})
