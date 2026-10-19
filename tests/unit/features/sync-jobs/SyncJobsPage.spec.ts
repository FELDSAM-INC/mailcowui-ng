// The sync job list page (UI 008 US1, US4, US5, US6): the jobs of the scope with their count, the
// create link carrying the owner filter, filter chips, the "no match" state with "Clear all",
// selection mode with the classic mass actions per role, the row menu's removal, and the log viewer
// opened from a list entry as a view parameter. The end-to-end specs cover the same paths in a
// browser; this keeps the page's wiring under the unit coverage.
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { identityQuery } from '@/app/session/queries'
import SyncJobsPage from '@/features/sync-jobs/pages/SyncJobsPage.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'

import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'

const mounted: VueWrapper[] = []
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})

const settle = (check: () => void) => vi.waitFor(check, { timeout: 5000 })

async function open(path: string, scenario = 'sync-jobs-admin') {
  useScenario(scenario)
  await testPlugins().queryClient.fetchQuery(identityQuery())
  const stub = { render: () => null }
  const router = createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [
      { path: '/sync-jobs', name: 'sync-jobs', component: SyncJobsPage },
      { path: '/sync-jobs/new', name: 'sync-job-create', component: stub },
      { path: '/sync-jobs/:syncJobId', name: 'sync-job-detail', component: stub },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mountWithApp(
    { components: { ConfirmDialog }, template: '<div><RouterView /><ConfirmDialog /></div>' },
    { global: { plugins: [router] }, attachTo: document.body },
  )
  mounted.push(wrapper)
  await settle(() =>
    expect(wrapper.get('[data-list-state]').attributes('data-list-state')).toMatch(
      /^(ready|empty)$/,
    ),
  )
  return { wrapper, router }
}

const button = (wrapper: VueWrapper, name: string) => {
  const found = wrapper.findAll('button').find((item) => item.text().trim() === name)
  if (!found) throw new Error(`no button "${name}"`)
  return found
}

describe('SyncJobsPage', () => {
  it('lists the jobs with their count and links the create page with the owner filter', async () => {
    const { wrapper } = await open('/sync-jobs?mailbox=alice@example.org')
    expect(wrapper.get('[data-result-count]').text()).toMatch(/^Sync jobs found: \d+$/)
    expect(wrapper.findAll('[data-entry]').length).toBeGreaterThan(0)
    const create = wrapper.findAll('a').find((link) => link.text().includes('Create new sync job'))
    expect(create?.attributes('href')).toBe('/ng/sync-jobs/new?mailbox=alice@example.org')
    expect(wrapper.text()).toContain('alice@example.org')
  })

  it('shows "no match" with "Clear all" and clears the search and filters', async () => {
    const { wrapper, router } = await open('/sync-jobs?q=no-such-job-anywhere&active=no')
    expect(wrapper.text()).toContain('No matching records found')
    await button(wrapper, 'Clear search and filters').trigger('click')
    await settle(() => expect(router.currentRoute.value.query).toEqual({}))
  })

  it('shows the empty state with the create link when the scope has no jobs', async () => {
    const { wrapper } = await open('/sync-jobs', 'sync-jobs-empty')
    expect(wrapper.find('[data-empty]').exists()).toBe(true)
    expect(wrapper.get('[data-list-state]').attributes('data-list-state')).toBe('empty')
  })

  it('offers "Schedule next" to administrators and runs a mass action on the selection', async () => {
    const { wrapper } = await open('/sync-jobs?q=previous')
    await button(wrapper, 'Select').trigger('click')
    const bar = () => wrapper.get('[aria-label="Bulk actions"]')
    const names = bar()
      .findAll('button')
      .map((item) => item.text().trim())
    expect(names.slice(0, 4)).toEqual(['Schedule next', 'Activate', 'Deactivate', 'Remove'])
    const checkbox = wrapper.get('input[type="checkbox"][aria-label^="Select alice@"]')
    await checkbox.setValue(true)
    const activate = bar()
      .findAll('button')
      .find((item) => item.text().trim() === 'Activate')!
    await activate.trigger('click')
    await settle(() =>
      expect(mockState().requests.some((r) => r.operationId === 'applySyncJobBulkAction')).toBe(
        true,
      ),
    )
    await settle(() => expect(wrapper.text()).toContain('Done'))
  })

  it('leaves "Schedule next" out for mailbox users', async () => {
    const { wrapper } = await open('/sync-jobs', 'sync-jobs-user')
    await button(wrapper, 'Select').trigger('click')
    const names = wrapper
      .get('[aria-label="Bulk actions"]')
      .findAll('button')
      .map((item) => item.text().trim())
    expect(names).not.toContain('Schedule next')
    await button(wrapper, 'Done selecting').trigger('click')
    expect(wrapper.find('[aria-label="Bulk actions"]').exists()).toBe(false)
  })

  it('removes a chip and with it the filter', async () => {
    const { wrapper, router } = await open('/sync-jobs?active=yes')
    const chip = wrapper
      .findAll('button')
      .find((item) => (item.attributes('aria-label') ?? '').includes('Active'))
    expect(chip).toBeDefined()
    await chip!.trigger('click')
    await settle(() => expect(router.currentRoute.value.query.active).toBeUndefined())
  })

  it('opens the log of a job as a view parameter and closes it again', async () => {
    const { wrapper, router } = await open('/sync-jobs?q=previous')
    const openLog = wrapper
      .get('[data-entry="2"]')
      .findAll('button')
      .find((item) => item.text().trim() === 'Open logs')
    expect(openLog).toBeDefined()
    await openLog!.trigger('click')
    await settle(() => expect(router.currentRoute.value.query.log).toBe('2'))
    await settle(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull())
    router.back()
    await settle(() => expect(router.currentRoute.value.query.log).toBeUndefined())
    await flushPromises()
  })
})
