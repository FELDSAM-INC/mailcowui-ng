// UI 011 (FR-011, FR-013, T064): exactly the actions the API reports, one at a time, with the
// progress and the elapsed time (never announced each second).
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import ContainerActions from '@/features/operations/dashboard/components/ContainerActions.vue'
import { settleConfirm } from '@/shared/composables/useConfirm'

import { useScenario } from '../../../../mocks/node'
import { mountWithApp } from '../../../support/mount'
import { container } from './helpers'

afterEach(() => settleConfirm(false))

describe('ContainerActions', () => {
  it('renders exactly the available actions in the order start, stop, restart', () => {
    const labels = (actions: ('start' | 'stop' | 'restart')[]) =>
      mountWithApp(ContainerActions, {
        props: { container: container({ availableActions: actions }) },
      })
        .findAll('[data-action]')
        .map((button) => button.text())
    expect(labels(['restart', 'stop'])).toEqual(['Stop', 'Restart'])
    expect(labels(['start', 'restart'])).toEqual(['Start', 'Restart'])
    expect(labels([])).toEqual([])
  })

  it('offers only the given actions with an own restart label', () => {
    const wrapper = mountWithApp(ContainerActions, {
      props: { container: container(), actions: ['restart'], restartLabel: 'Restart netfilter' },
    })
    expect(wrapper.findAll('[data-action]').map((button) => button.text())).toEqual([
      'Restart netfilter',
    ])
  })

  it('shows the progress with the elapsed time, hidden from screen readers, and blocks actions', async () => {
    useScenario('ops-container-actions')
    const wrapper = mountWithApp(ContainerActions, {
      props: { container: container({ name: 'sogo-mailcow', availableActions: ['start'] }) },
    })
    await wrapper.get('[data-action="start"]').trigger('click')
    await nextTick()
    const progress = wrapper.get('[data-action-progress]')
    expect(progress.text()).toContain('Starting container, this may take a while')
    expect(progress.get('[aria-hidden="true"]').text()).toMatch(/\(\d+ s\)/)
    expect(wrapper.get('[data-action="start"]').attributes('aria-disabled')).toBe('true')
    await new Promise((resolve) => setTimeout(resolve, 3200))
    await flushPromises()
    expect(wrapper.get('[data-action-outcome]').text()).toContain('OK')
  })
})
