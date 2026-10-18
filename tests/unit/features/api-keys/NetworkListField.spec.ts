// T127: the allowed networks field (FR-065): entries are added and removed, at most 100, each is
// checked with isIpNetwork, and server errors appear on their entry.
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import NetworkListField from '@/features/api-keys/components/NetworkListField.vue'
import { validateNetworks } from '@/features/api-keys/networks'

import { mountWithApp } from '../../support/mount'

function mountField(initial: string[], errors: Record<string, string[]> = {}) {
  const value = ref(initial)
  const Host = defineComponent({
    setup: () => () =>
      h(NetworkListField, {
        modelValue: value.value,
        'onUpdate:modelValue': (next: string[]) => (value.value = next),
        idPrefix: 'networks',
        errorsFor: (path: string) => errors[path] ?? [],
      }),
  })
  const wrapper = mountWithApp(Host, { attachTo: document.body })
  return { wrapper, value }
}

describe('NetworkListField', () => {
  it('adds and removes entries, with labels by position', async () => {
    const { wrapper, value } = mountField([])
    await wrapper.get('button[data-add]').trigger('click')
    await wrapper.get('button[data-add]').trigger('click')
    expect(value.value).toEqual(['', ''])
    const labels = wrapper.findAll('label').map((label) => label.text())
    expect(labels).toEqual(['Allowed network 1', 'Allowed network 2'])
    await wrapper.findAll('input')[1]!.setValue('2001:db8::/32')
    expect(value.value).toEqual(['', '2001:db8::/32'])
    await wrapper.get('button[aria-label="Remove network 1"]').trigger('click')
    expect(value.value).toEqual(['2001:db8::/32'])
    expect(document.activeElement).toBe(wrapper.findAll('input')[0]!.element)
  })

  it('allows at most 100 entries and says so', () => {
    const { wrapper } = mountField(Array.from({ length: 100 }, (_, i) => `192.0.2.${i}`))
    expect(wrapper.get('button[data-add]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('At most 100 networks.')
  })

  it('shows the errors of each entry on that entry', () => {
    const { wrapper } = mountField(['192.0.2.0/24', '999.1.1.1'], {
      'allowedNetworks.1': ['Enter an IPv4 or IPv6 address or network, for example 192.0.2.0/24.'],
    })
    const inputs = wrapper.findAll('input')
    expect(inputs[0]!.attributes('aria-invalid')).toBeUndefined()
    expect(inputs[1]!.attributes('aria-invalid')).toBe('true')
    expect(inputs[1]!.attributes('id')).toBe('networks-1')
  })
})

describe('validateNetworks', () => {
  it('drops empty entries and checks each one with isIpNetwork', () => {
    expect(validateNetworks([' 192.0.2.0/24 ', '', '2001:db8::1', '999.1.1.1', 'x'])).toEqual({
      networks: ['192.0.2.0/24', '2001:db8::1', '999.1.1.1', 'x'],
      errors: {
        'allowedNetworks.2': ['validation.format.ipNetwork'],
        'allowedNetworks.3': ['validation.format.ipNetwork'],
      },
    })
  })

  it('refuses more than 100 entries and entries longer than 49 characters', () => {
    const many = Array.from({ length: 101 }, (_, i) => `10.0.0.${i % 250}`)
    expect(validateNetworks(many).errors.allowedNetworks).toEqual(['validation.tooMany'])
    expect(validateNetworks([`${'1:'.repeat(25)}1`]).errors['allowedNetworks.0']).toEqual([
      'validation.format.ipNetwork',
    ])
  })
})
