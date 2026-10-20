import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, type PropType } from 'vue'
import type { SettingsCapabilities } from '@/api'

import SettingsLayout from '@/features/system-settings/layouts/SettingsLayout.vue'

import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

const child = defineComponent({
  props: { capabilities: { type: Object as PropType<SettingsCapabilities>, required: true } },
  setup: (props) => () => h('div', { 'data-child': true }, String(props.capabilities.demoMode)),
})
const view = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      slots.default?.({ Component: child }),
})
const mount = () => mountWithApp(SettingsLayout, { global: { stubs: { RouterView: view } } })

describe('settings capabilities layout', () => {
  it('waits for capabilities before mounting a page and supplies its demo mode', async () => {
    useScenario('settings-demo-mode', { delays: { getSettingsCapabilities: 150 } })
    const wrapper = mount()
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true)
    expect(wrapper.find('[data-child]').exists()).toBe(false)
    await vi.waitFor(() => expect(wrapper.find('[data-child]').text()).toBe('true'))
  })
  it('shows a retry on failure without mounting the page', async () => {
    useScenario('settings-capabilities-error')
    const wrapper = mount()
    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))
    expect(wrapper.find('[data-child]').exists()).toBe(false)
    delete mockState().failures.getSettingsCapabilities
    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-child]').text()).toBe('false'))
  })
})
