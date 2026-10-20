// UI 011 (FR-029, T130): "Show public IP" only when the IP check is enabled, then both addresses or
// "-"; the classic explanation when the check is off or was switched off meanwhile.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import PublicAddresses from '@/features/operations/dashboard/components/PublicAddresses.vue'

import { mockState, useScenario } from '../../../../mocks/node'
import { mountWithApp } from '../../../support/mount'
import { createTestRouter } from '../../../support/router'

function mountAddresses(scenario: string, ipCheckEnabled: boolean) {
  useScenario(scenario)
  return mountWithApp(PublicAddresses, {
    props: { ipCheckEnabled },
    global: { plugins: [createTestRouter()] },
  })
}

describe('PublicAddresses', () => {
  it.each([true, false])(
    'links to IP Check settings whether lookup is enabled=%s, without starting a lookup',
    async (enabled) => {
      const wrapper = mountAddresses('admin-operations', enabled)
      await vi.waitFor(() =>
        expect(wrapper.find('a[href="/ng/system/ip-check"]').exists()).toBe(true),
      )
      expect(wrapper.get('a[href="/ng/system/ip-check"]').text()).toBe('IP Check')
      expect(
        mockState().requests.some((request) => request.operationId === 'getPublicAddresses'),
      ).toBe(false)
      wrapper.unmount()
    },
  )

  it.each(['domain-admin-operations', 'mailbox-user-operations'])(
    'does not offer IP Check settings to %s',
    async (scenario) => {
      const wrapper = mountAddresses(scenario, false)
      await vi.waitFor(() =>
        expect(mockState().requests.some((request) => request.operationId === 'getIdentity')).toBe(
          true,
        ),
      )
      await flushPromises()
      expect(wrapper.find('a[href="/ng/system/ip-check"]').exists()).toBe(false)
      wrapper.unmount()
    },
  )

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
