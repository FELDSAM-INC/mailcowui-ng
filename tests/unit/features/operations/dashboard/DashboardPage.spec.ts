// UI 011 US1 (FR-002, FR-018–FR-025): the dashboard page wires the live-update bar (pause, resume,
// manual refresh, capabilities that could not be read), shows each section's own error, and opens
// and focuses the card a container's address names; an unknown container is "not found".
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import DashboardPage from '@/features/operations/dashboard/pages/DashboardPage.vue'

import { mockState, useScenario } from '../../../../mocks/node'
import type { ScenarioOverrides } from '../../../../mocks/scenarios/state'
import { installMatchMedia } from '../../../support/media'
import { mountWithApp } from '../../../support/mount'
import { createTestRouter } from '../../../support/router'

const settle = (check: () => void) => vi.waitFor(check, { timeout: 10_000 })
const count = (operationId: string) =>
  mockState().requests.filter((request) => request.operationId === operationId).length

let unmount: (() => void) | null = null
afterEach(() => {
  unmount?.()
  unmount = null
})

async function openDashboard(
  options: { scenario?: string; overrides?: ScenarioOverrides; expand?: string } = {},
) {
  installMatchMedia({ '(min-width: 768px)': true })
  useScenario(options.scenario ?? 'admin-operations', options.overrides)
  const router = createTestRouter()
  await router.push(
    options.expand ? `/operations/containers/${options.expand}` : '/operations/dashboard',
  )
  await router.isReady()
  const wrapper = mountWithApp(DashboardPage, {
    props: options.expand ? { expand: options.expand } : {},
    attachTo: document.body,
    global: { plugins: [router] },
  })
  unmount = () => wrapper.unmount()
  await flushPromises()
  return { wrapper, router }
}

const button = (wrapper: { findAll: (s: string) => { text: () => string }[] }, name: string) =>
  wrapper.findAll('button').find((item) => item.text() === name) as unknown as {
    trigger: (event: string) => Promise<void>
  }

describe('DashboardPage', { timeout: 30_000 }, () => {
  it('links the administrator to Queue Manager from the dashboard', async () => {
    const { wrapper, router } = await openDashboard()
    await settle(() =>
      expect(wrapper.find('a[href="/ng/operations/mail-queue"]').exists()).toBe(true),
    )
    const link = wrapper.get('a[href="/ng/operations/mail-queue"]')
    expect(link.text()).toBe('Queue Manager')
    await link.trigger('click')
    await settle(() => expect(router.currentRoute.value.name).toBe('operations-mail-queue'))
  })

  it.each(['domain-admin-operations', 'mailbox-user-operations'])(
    'does not offer Queue Manager to %s',
    async (scenario) => {
      const { wrapper } = await openDashboard({ scenario })
      await settle(() => expect(count('getIdentity')).toBeGreaterThan(0))
      expect(wrapper.find('a[href="/ng/operations/mail-queue"]').exists()).toBe(false)
    },
  )

  it('shows the host and every container, and pauses, resumes and refreshes live updates', async () => {
    const { wrapper } = await openDashboard()
    await settle(() => expect(wrapper.find('[data-hostname]').exists()).toBe(true))
    await settle(() => expect(wrapper.findAll('[data-containers] li').length).toBeGreaterThan(5))
    expect(wrapper.get('h1').text()).toBe('System & Containers')

    await button(wrapper, 'Pause live updates').trigger('click')
    await settle(() =>
      expect(wrapper.get('[data-live-notice]').text()).toMatch(/^Live updates paused since/),
    )
    const before = count('getHostOverview')
    await button(wrapper, 'Resume live updates').trigger('click')
    await settle(() => expect(count('getHostOverview')).toBeGreaterThan(before))
    expect(wrapper.find('[data-live-notice]').exists()).toBe(false)

    const again = count('listContainers')
    await button(wrapper, 'Refresh').trigger('click')
    await settle(() => expect(count('listContainers')).toBeGreaterThan(again))
  })

  it('says live updates are off when the capabilities cannot be read, and retries them', async () => {
    const { wrapper } = await openDashboard({ scenario: 'ops-capabilities-unavailable' })
    await settle(() =>
      expect(wrapper.get('[data-live-notice]').text()).toBe(
        'Live updates are off because the monitoring settings could not be read.',
      ),
    )
    const before = count('getMonitoringCapabilities')
    await button(wrapper, 'Try again').trigger('click')
    await settle(() => expect(count('getMonitoringCapabilities')).toBeGreaterThan(before))
  })

  it('shows its own error in each section while the container service is down', async () => {
    const { wrapper } = await openDashboard({ scenario: 'ops-container-service-down' })
    await settle(() =>
      expect(wrapper.findAll('[data-section-error]').length).toBeGreaterThanOrEqual(2),
    )
    const containersError = wrapper.get('[data-containers] [data-section-error]')
    const before = count('listContainers')
    await containersError.get('button').trigger('click')
    await settle(() => expect(count('listContainers')).toBeGreaterThan(before))
  })

  it("opens and focuses the card a container's address names, and returns on collapse", async () => {
    const { wrapper, router } = await openDashboard({ expand: 'sogo-mailcow' })
    const card = () => wrapper.get('[data-container="sogo-mailcow"]')
    await settle(() => expect(card().find('[data-container-details]').exists()).toBe(true))
    await settle(() => expect(document.activeElement).toBe(card().get('[data-expand]').element))
    await card().get('[data-expand]').trigger('click')
    await settle(() => expect(router.currentRoute.value.name).toBe('operations-dashboard'))
    expect(card().find('[data-container-details]').exists()).toBe(false)
    const other = wrapper.get('[data-container="postfix-mailcow"] [data-expand]')
    await other.trigger('click')
    expect(
      wrapper.find('[data-container="postfix-mailcow"] [data-container-details]').exists(),
    ).toBe(true)
  })

  it('shows "not found" for a container the installation does not have', async () => {
    const { wrapper } = await openDashboard({ expand: 'ghost-mailcow' })
    await settle(() => expect(wrapper.text()).toContain('Page not found'))
    expect(wrapper.find('[data-containers]').exists()).toBe(false)
  })

  it('marks the values as possibly outdated when a refresh fails after a first read', async () => {
    const { wrapper } = await openDashboard()
    await settle(() => expect(wrapper.find('[data-hostname]').exists()).toBe(true))
    mockState().operations.inject.getHostOverview = {
      status: 503,
      problemType: 'temporary-failure',
    }
    await button(wrapper, 'Refresh').trigger('click')
    await settle(() =>
      expect(wrapper.get('[data-live-failed]').text()).toBe(
        'Updating failed. The values shown may be out of date.',
      ),
    )
    expect(wrapper.find('[data-hostname]').exists()).toBe(true)
  })
})
