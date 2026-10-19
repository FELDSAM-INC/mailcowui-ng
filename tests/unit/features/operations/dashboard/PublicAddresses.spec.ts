// UI 011 (FR-029, T130): "Show public IP" only when the IP check is enabled, then both addresses or
// "-"; the classic explanation when the check is off or was switched off meanwhile.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PublicAddresses from '@/features/operations/dashboard/components/PublicAddresses.vue'

import { mockState, useScenario } from '../../../../mocks/node'
import { mountWithApp } from '../../../support/mount'

function mountAddresses(scenario: string, ipCheckEnabled: boolean) {
  useScenario(scenario)
  return mountWithApp(PublicAddresses, { props: { ipCheckEnabled } })
}

describe('PublicAddresses', () => {
  it('reads the addresses only on request and shows both', async () => {
    const wrapper = mountAddresses('admin-operations', true)
    await flushPromises()
    expect(mockState().requests.some((r) => r.operationId === 'getPublicAddresses')).toBe(false)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-ipv4]').text()).toBe('203.0.113.10')
    expect(wrapper.get('[data-ipv6]').text()).toBe('2001:db8::10')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('shows "-" for an address the API could not determine', async () => {
    const wrapper = mountAddresses('ops-ip-partial', true)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-ipv6]').text()).toBe('-')
  })

  it('explains where to switch the check on when it is off', () => {
    const wrapper = mountAddresses('ops-ip-check-disabled', false)
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toContain('IP check is disabled')
  })

  it('shows the same explanation when the lookup is refused as disabled', async () => {
    const wrapper = mountAddresses('ops-ip-disabled-meanwhile', true)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('IP check is disabled')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
