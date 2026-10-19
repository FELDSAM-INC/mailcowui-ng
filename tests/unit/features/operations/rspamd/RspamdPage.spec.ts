// UI 011 US6 (FR-045 to FR-049, T118/T124; plan decisions 5, 6, 11, 12, 18 and 19): the Rspamd
// page against the contract-validated mock: the per-action bars with their summary and table, the
// zero state, the scan history with search, sort and paging in the address, details and symbols in
// place, Expand All and Collapse All, and the statistics and the history failing on their own.
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import LogQuickActions from '@/features/operations/logs/components/LogQuickActions.vue'
import RspamdPage from '@/features/operations/rspamd/pages/RspamdPage.vue'

import type { ScenarioOverrides } from '../../../../mocks/scenarios'
import { mockState, useScenario } from '../../../../mocks/node'
import { installMatchMedia } from '../../../support/media'
import { mountWithApp } from '../../../support/mount'
import { createTestRouter } from '../../../support/router'

const WIDE = '(min-width: 768px)'

/** Waits with room for a loaded machine (the default of `vi.waitFor` is one second). */
const waitFor = <T>(callback: () => T, options: { timeout?: number } = {}) =>
  vi.waitFor(callback, { timeout: 5000, ...options })

async function mountRspamd(
  options: {
    scenario?: string
    overrides?: ScenarioOverrides
    query?: string
    wide?: boolean
  } = {},
) {
  useScenario(options.scenario ?? 'ops-rspamd', options.overrides)
  installMatchMedia({ [WIDE]: options.wide ?? false })
  const router = createTestRouter()
  await router.push(`/operations/logs/rspamd${options.query ?? ''}`)
  await router.isReady()
  const wrapper = mountWithApp(RspamdPage, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

const statistics = (wrapper: VueWrapper) => wrapper.get('[data-rspamd-statistics]')
const history = (wrapper: VueWrapper) => wrapper.get('[data-rspamd-history]')

async function historyReady(wrapper: VueWrapper) {
  await waitFor(
    () =>
      expect(
        wrapper
          .find('[data-rspamd-history] [data-entry], [data-history-empty], [data-history-error]')
          .exists(),
      ).toBe(true),
    { timeout: 5000 },
  )
  await flushPromises()
}

const requestsOf = (operationId: string) =>
  mockState().requests.filter((request) => request.operationId === operationId)

describe('RspamdPage', () => {
  it('US6-AS2 FR-045 shows the per-action bars of this server and the history of all servers', async () => {
    const { wrapper } = await mountRspamd()
    expect(wrapper.get('h1').text()).toBe('Rspamd history')
    await waitFor(() => expect(statistics(wrapper).find('[data-summary]').exists()).toBe(true))
    expect(statistics(wrapper).get('h2').text()).toBe('Chart (this server)')
    expect(statistics(wrapper).findAll('[data-action]').length).toBeGreaterThan(0)
    await historyReady(wrapper)
    expect(history(wrapper).get('h2').text()).toBe('History (all servers)')
    expect(history(wrapper).findAll('[data-entry]')).toHaveLength(25)
    expect(wrapper.text()).toContain('Showing 1 to 25 of 61 entries')
    expect(requestsOf('getRspamdStatistics')).toHaveLength(1)
    wrapper.unmount()
  })

  it('US6-AS1 FR-047 searches the history through the address and the API', async () => {
    const { wrapper } = await mountRspamd({ query: '?q=spammer%40example.net' })
    await historyReady(wrapper)
    const entries = history(wrapper).findAll('[data-entry]')
    expect(entries).toHaveLength(1)
    expect(entries[0]!.text()).toContain('reject')
    expect(requestsOf('listRspamdHistory')[0]!.path).toContain('q=spammer%40example.net')
    wrapper.unmount()
  })

  it('FR-049 no matching scans offers to clear the search', async () => {
    const { wrapper, router } = await mountRspamd({ query: '?q=nothing-matches-this' })
    await historyReady(wrapper)
    const empty = wrapper.get('[data-history-empty]')
    expect(empty.text()).toContain('No matching records found')
    await empty.get('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.q).toBeUndefined()
    wrapper.unmount()
  })

  it('FR-046 FR-049 says that nothing was scanned yet, and shows an empty history', async () => {
    const { wrapper } = await mountRspamd({ scenario: 'ops-rspamd-zero' })
    await waitFor(() => expect(statistics(wrapper).find('[data-none-scanned]').exists()).toBe(true))
    await historyReady(wrapper)
    const empty = wrapper.get('[data-history-empty]')
    expect(empty.text()).toBe('No data available in table')
    expect(empty.find('button').exists()).toBe(false)
    wrapper.unmount()
  })

  it('US6-AS4 the statistics and the history are each temporarily unavailable, with a retry', async () => {
    const { wrapper } = await mountRspamd({ scenario: 'ops-rspamd-unavailable' })
    await historyReady(wrapper)
    await waitFor(() => expect(statistics(wrapper).find('[role="alert"]').exists()).toBe(true))
    expect(statistics(wrapper).get('[role="alert"]').text()).toBe(
      'Rspamd cannot be reached right now.',
    )
    expect(wrapper.get('[data-history-error] [role="alert"]').text()).toBe(
      'Rspamd cannot be reached right now.',
    )
    const statisticsBefore = requestsOf('getRspamdStatistics').length
    const historyBefore = requestsOf('listRspamdHistory').length
    await statistics(wrapper).get('button').trigger('click')
    await wrapper.get('[data-history-error] button').trigger('click')
    await waitFor(() => expect(requestsOf('getRspamdStatistics').length).toBe(statisticsBefore + 1))
    await waitFor(() => expect(requestsOf('listRspamdHistory').length).toBe(historyBefore + 1))
    wrapper.unmount()
  })

  it('FR-049 another failure shows the list error with the translated problem', async () => {
    const { wrapper } = await mountRspamd({
      overrides: {
        operations: {
          inject: { getRspamdStatistics: { status: 500 }, listRspamdHistory: { status: 500 } },
        },
      },
    })
    await historyReady(wrapper)
    await waitFor(() => expect(statistics(wrapper).find('[role="alert"]').exists()).toBe(true))
    expect(statistics(wrapper).text()).toContain('The list could not be loaded.')
    expect(wrapper.get('[data-history-error]').text()).toContain('The list could not be loaded.')
    wrapper.unmount()
  })

  it('FR-047 sorts and orders on phones through the address', async () => {
    const { wrapper, router } = await mountRspamd()
    await historyReady(wrapper)
    await wrapper.get('#operations-rspamd-sort').setValue('score')
    await flushPromises()
    expect(router.currentRoute.value.query.sort).toBe('score')
    await historyReady(wrapper)
    await wrapper.get('#operations-rspamd-order').setValue('asc')
    await flushPromises()
    expect(router.currentRoute.value.query.order).toBe('asc')
    await waitFor(() =>
      expect(requestsOf('listRspamdHistory').at(-1)!.path).toMatch(
        /sort=score.*order=asc|order=asc.*sort=score/,
      ),
    )
    wrapper.unmount()
  })

  it('FR-047 sorts by the table headers and pages through the history on wide screens', async () => {
    const { wrapper, router } = await mountRspamd({ wide: true })
    await historyReady(wrapper)
    expect(wrapper.find('#operations-rspamd-sort').exists()).toBe(false)
    await wrapper.get('[data-sort="size"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.sort).toBe('size')
    await historyReady(wrapper)
    const next = wrapper.get('button[aria-label="Next"]')
    await next.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.page).toBe('2')
    await waitFor(() => expect(requestsOf('listRspamdHistory').at(-1)!.path).toContain('offset=25'))
    wrapper.unmount()
  })

  it('FR-048 opens an entry in place, and Expand All and Collapse All open every entry', async () => {
    const { wrapper } = await mountRspamd()
    await historyReady(wrapper)
    expect(wrapper.findAll('[data-details]')).toHaveLength(0)
    const first = history(wrapper).get('[data-entry]')
    await first.get('button[aria-expanded]').trigger('click')
    expect(wrapper.findAll('[data-details]')).toHaveLength(1)
    expect(wrapper.get('[data-details]').findAll('[data-symbol]').length).toBeGreaterThan(0)
    await first.get('button[aria-expanded]').trigger('click')
    expect(wrapper.findAll('[data-details]')).toHaveLength(0)
    const actions = wrapper.findComponent(LogQuickActions)
    expect(actions.props('more')).toBe(false)
    actions.vm.$emit('expandAll')
    await nextTick()
    expect(wrapper.findAll('[data-details]')).toHaveLength(25)
    actions.vm.$emit('collapseAll')
    await nextTick()
    expect(wrapper.findAll('[data-details]')).toHaveLength(0)
    wrapper.unmount()
  })

  it('FR-038 Refresh reads the statistics and the history again', async () => {
    const { wrapper } = await mountRspamd()
    await historyReady(wrapper)
    await waitFor(() => expect(statistics(wrapper).find('[data-summary]').exists()).toBe(true))
    const statisticsBefore = requestsOf('getRspamdStatistics').length
    const historyBefore = requestsOf('listRspamdHistory').length
    const refresh = wrapper.findAll('button').find((button) => button.text() === 'Refresh')!
    await refresh.trigger('click')
    await waitFor(() => expect(requestsOf('getRspamdStatistics').length).toBe(statisticsBefore + 1))
    await waitFor(() => expect(requestsOf('listRspamdHistory').length).toBe(historyBefore + 1))
    wrapper.unmount()
  })
})
