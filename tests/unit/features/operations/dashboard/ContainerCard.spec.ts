// UI 011 (FR-008, FR-010, FR-085, T052): a container card as legacy shows it: the name as the
// item's heading, the image, the start time, "Running" or "Stopped" with an icon, and the caret
// button that expands the resources, the available actions and History.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { Container } from '@/api'
import ContainerCard from '@/features/operations/dashboard/components/ContainerCard.vue'

import { useScenario } from '../../../../mocks/node'
import { mountWithApp } from '../../../support/mount'
import { createTestRouter } from '../../../support/router'
import { container } from './helpers'

async function mountCard(props: { container: Container; expanded: boolean }) {
  useScenario('admin-operations')
  const router = createTestRouter()
  await router.push('/operations/dashboard')
  const wrapper = mountWithApp(ContainerCard, { props, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('ContainerCard', () => {
  it('shows the name as heading, the image, the start time and "Running"', async () => {
    const wrapper = await mountCard({ container: container(), expanded: false })
    expect(wrapper.get('h3').text()).toBe('sogo-mailcow')
    expect(wrapper.text()).toContain('(ghcr.io/mailcow/sogo:1.133)')
    expect(wrapper.get('[data-started]').text()).toMatch(/^\(Started on .+\)$/)
    expect(wrapper.get('[data-state="running"]').text()).toBe('Running')
    expect(wrapper.find('[data-state="running"] svg').exists()).toBe(true)
  })

  it('shows "Stopped" with an icon for any container that is not running', async () => {
    for (const state of ['exited', 'dead', 'created'] as const) {
      const wrapper = await mountCard({
        container: container({ state, running: false, availableActions: ['start', 'restart'] }),
        expanded: false,
      })
      expect(wrapper.get('[data-state="stopped"]').text()).toBe('Stopped')
      expect(wrapper.find('[data-state="stopped"] svg').exists()).toBe(true)
    }
  })

  it('shows "-" for a container that never started', async () => {
    const wrapper = await mountCard({ container: container({ startedAt: null }), expanded: false })
    expect(wrapper.get('[data-started]').text()).toBe('(Started on -)')
  })

  it('expands with a labelled button that controls the details', async () => {
    const wrapper = await mountCard({ container: container(), expanded: false })
    const button = wrapper.get('[data-expand]')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(button.attributes('aria-label')).toBe('Show details of sogo-mailcow')
    expect(wrapper.find('[data-container-details]').exists()).toBe(false)
    await button.trigger('click')
    expect(wrapper.emitted('toggle')).toHaveLength(1)
  })

  it('shows the resources, the available actions and History when expanded', async () => {
    const wrapper = await mountCard({ container: container(), expanded: true })
    const button = wrapper.get('[data-expand]')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(button.attributes('aria-label')).toBe('Hide details of sogo-mailcow')
    const details = wrapper.get(`#${button.attributes('aria-controls')}`)
    expect(details.findAll('[data-action]').map((action) => action.text())).toEqual([
      'Stop',
      'Restart',
    ])
    expect(details.get('a').attributes('href')).toBe(
      '/ng/audit-log?targetType=container&targetId=sogo-mailcow',
    )
  })
})
