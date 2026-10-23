// UI 011 US3 (FR-030 to FR-044, T072/T083; plan decisions 5, 6, 10, 11, 12 and 18): a log page
// against the contract-validated mock: the newest 50 entries with legacy's count line, "+ 100" and
// "+ 1000" without duplicates, the search and the time order in the address, Expand All and
// Collapse All, the loading, empty, no match, error and unavailable states, an unknown log type,
// and the rate limit reset with legacy's confirmation and outcomes.
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import LogPage from '@/features/operations/logs/pages/LogPage.vue'
import LogQuickActions from '@/features/operations/logs/components/LogQuickActions.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'
import { clearStatusMessages, useStatusMessage } from '@/shared/composables/useStatusMessage'

import type { ScenarioOverrides } from '../../../../mocks/scenarios'
import { mockState, useScenario } from '../../../../mocks/node'
import { installMatchMedia } from '../../../support/media'
import { mountWithApp } from '../../../support/mount'
import { sortList } from '../../../support/data-list'
import { createTestRouter } from '../../../support/router'

const WIDE = '(min-width: 768px)'

/** Waits with room for a loaded machine (the default of `vi.waitFor` is one second). */
const waitFor = <T>(callback: () => T, options: { timeout?: number } = {}) =>
  vi.waitFor(callback, { timeout: 5000, ...options })

afterEach(() => {
  settleConfirm(false)
  clearStatusMessages()
})

async function mountLog(
  slug: string,
  options: {
    scenario?: string
    overrides?: ScenarioOverrides
    query?: string
    wide?: boolean
  } = {},
) {
  useScenario(options.scenario ?? 'admin-operations', options.overrides)
  installMatchMedia({ [WIDE]: options.wide ?? false })
  const router = createTestRouter()
  await router.push(`/operations/logs/${slug}${options.query ?? ''}`)
  await router.isReady()
  const wrapper = mountWithApp(LogPage, {
    props: { logType: slug },
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

/** Waits until the page shows entries, an empty state or an error. */
async function settled(wrapper: VueWrapper) {
  await waitFor(
    () => {
      expect(wrapper.find('[data-entry], [data-log-empty], [data-log-error]').exists()).toBe(true)
    },
    { timeout: 5000 },
  )
  await flushPromises()
}

const ids = (wrapper: VueWrapper) =>
  wrapper.findAll('[data-entry]').map((entry) => entry.attributes('data-entry'))

const requestsOf = (operationId: string) =>
  mockState().requests.filter((request) => request.operationId === operationId)

function quickActions(wrapper: VueWrapper) {
  return wrapper.findComponent(LogQuickActions)
}

describe('LogPage', () => {
  it('US3-AS1 shows the newest 50 entries with the total, then adds older ones without duplicates', async () => {
    const { wrapper } = await mountLog('postfix', { scenario: 'ops-logs-large' })
    await settled(wrapper)
    expect(wrapper.get('h1').text()).toBe('Postfix')
    expect(ids(wrapper)).toHaveLength(50)
    expect(wrapper.get('[data-log-count]').text()).toBe('Showing 1 to 50 of 10,003 entries')
    const first = requestsOf('listPostfixLog')[0]!
    expect(first.path).toContain('limit=50')
    expect(first.path).toContain('order=desc')

    quickActions(wrapper).vm.$emit('more', 100)
    await waitFor(() => expect(ids(wrapper)).toHaveLength(150))
    expect(wrapper.get('[data-load-outcome]').text()).toBe('100 additional rows were added')
    const second = requestsOf('listPostfixLog')[1]!
    expect(second.path).toContain('limit=100')
    expect(second.path).toMatch(/before=postfix-/)
    expect(new Set(ids(wrapper)).size).toBe(150)

    quickActions(wrapper).vm.$emit('more', 1000)
    await waitFor(() => expect(ids(wrapper)).toHaveLength(1150), { timeout: 20_000 })
    expect(new Set(ids(wrapper)).size).toBe(1150)
    expect(wrapper.get('[data-load-outcome]').text()).toBe('1,000 additional rows were added')
    wrapper.unmount()
  }, 40_000)

  it('says "No further rows available" when nothing older remains', async () => {
    const { wrapper } = await mountLog('acme')
    await settled(wrapper)
    expect(ids(wrapper)).toHaveLength(50)
    quickActions(wrapper).vm.$emit('more', 1000)
    await waitFor(() => expect(ids(wrapper)).toHaveLength(120), { timeout: 5000 })
    quickActions(wrapper).vm.$emit('more', 100)
    await waitFor(() =>
      expect(wrapper.get('[data-load-outcome]').text()).toBe('No further rows available'),
    )
    expect(ids(wrapper)).toHaveLength(120)
    wrapper.unmount()
  })

  it('FR-036 oldest first continues by offset, and the order lives in the address', async () => {
    const { wrapper, router } = await mountLog('dovecot', { query: '?order=asc' })
    await settled(wrapper)
    expect(router.currentRoute.value.query.order).toBe('asc')
    quickActions(wrapper).vm.$emit('more', 100)
    await waitFor(() => expect(ids(wrapper)).toHaveLength(120))
    const next = requestsOf('listDovecotLog').at(-1)!
    expect(next.path).toContain('order=asc')
    expect(next.path).toContain('offset=50')
    expect(next.path).not.toContain('before=')
    await sortList(wrapper, 'time')
    await flushPromises()
    expect(router.currentRoute.value.query.order).toBeUndefined()
    wrapper.unmount()
  })

  it('FR-035 FR-037 the search goes to the address and to the API, and "no match" clears it', async () => {
    const { wrapper, router } = await mountLog('postfix', { query: '?q=NOTHING-MATCHES' })
    await settled(wrapper)
    expect(wrapper.get('[data-log-empty]').text()).toContain('No matching records found')
    expect(requestsOf('listPostfixLog')[0]!.path).toContain('q=NOTHING-MATCHES')
    await wrapper.get('[data-log-empty] button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.q).toBeUndefined()
    await settled(wrapper)
    expect(ids(wrapper)).toHaveLength(50)
    wrapper.unmount()
  })

  it('FR-043 an empty log says so without a clear action', async () => {
    const { wrapper } = await mountLog('cron', { scenario: 'ops-logs-empty' })
    await settled(wrapper)
    expect(wrapper.get('[data-log-empty]').text()).toBe('No data available in table')
    expect(wrapper.find('[data-log-empty] button').exists()).toBe(false)
    expect(wrapper.find('[data-log-count]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('US3-AS8 a log that is temporarily unavailable says so and retries', async () => {
    const { wrapper } = await mountLog('postfix', { scenario: 'ops-logs-unavailable' })
    await settled(wrapper)
    const error = wrapper.get('[data-log-error]')
    expect(error.text()).toContain('This log is temporarily unavailable.')
    const before = requestsOf('listPostfixLog').length
    await error.get('button').trigger('click')
    await flushPromises()
    await waitFor(() => expect(requestsOf('listPostfixLog').length).toBe(before + 1))
    wrapper.unmount()
  })

  it('FR-043 another failure shows the list error with the translated problem', async () => {
    const { wrapper } = await mountLog('sogo', {
      overrides: { operations: { inject: { listSogoLog: { status: 500 } } } },
    })
    await settled(wrapper)
    const error = wrapper.get('[data-log-error]')
    expect(error.text()).toContain('The list could not be loaded.')
    expect(error.find('[role="alert"] + *').exists()).toBe(true)
    wrapper.unmount()
  })

  it('FR-043 entries stay with a notice when loading more fails', async () => {
    const { wrapper } = await mountLog('netfilter')
    await settled(wrapper)
    mockState().operations.inject.listNetfilterLog = {
      status: 503,
      problemType: 'temporary-failure',
    }
    quickActions(wrapper).vm.$emit('more', 100)
    await waitFor(() => expect(wrapper.find('[data-update-failed]').exists()).toBe(true))
    expect(ids(wrapper)).toHaveLength(50)
    expect(wrapper.find('[data-load-outcome]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('FR-038 Refresh loads the newest entries again', async () => {
    const { wrapper } = await mountLog('watchdog', { scenario: 'ops-logs-large' })
    await settled(wrapper)
    const before = requestsOf('listWatchdogLog').length
    const refresh = wrapper.findAll('button').find((button) => button.text() === 'Refresh')!
    await refresh.trigger('click')
    await waitFor(() => expect(requestsOf('listWatchdogLog').length).toBe(before + 1))
    await settled(wrapper)
    expect(ids(wrapper)).toHaveLength(50)
    wrapper.unmount()
  })

  it('FR-043 a failed Refresh keeps the entries shown with a notice', async () => {
    const { wrapper } = await mountLog('netfilter')
    await settled(wrapper)
    quickActions(wrapper).vm.$emit('more', 100)
    await waitFor(() => expect(ids(wrapper).length).toBeGreaterThan(50))
    const shown = ids(wrapper)
    mockState().operations.inject.listNetfilterLog = {
      status: 503,
      problemType: 'temporary-failure',
    }
    const refresh = wrapper.findAll('button').find((button) => button.text() === 'Refresh')!
    await refresh.trigger('click')
    await waitFor(() => expect(wrapper.find('[data-update-failed]').exists()).toBe(true))
    expect(ids(wrapper)).toEqual(shown)
    expect(wrapper.find('[data-log-error]').exists()).toBe(false)
    delete mockState().operations.inject.listNetfilterLog
    await refresh.trigger('click')
    await waitFor(() => expect(ids(wrapper)).toHaveLength(50))
    expect(wrapper.find('[data-update-failed]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('plan decision 6 Expand All and Collapse All open and close every entry', async () => {
    const { wrapper } = await mountLog('autodiscover')
    await settled(wrapper)
    expect(wrapper.findAll('[data-details]')).toHaveLength(0)
    quickActions(wrapper).vm.$emit('expandAll')
    await nextTick()
    expect(wrapper.findAll('[data-details]')).toHaveLength(50)
    quickActions(wrapper).vm.$emit('collapseAll')
    await nextTick()
    expect(wrapper.findAll('[data-details]')).toHaveLength(0)
    const first = wrapper.get('[data-entry]')
    await first.get('button[aria-expanded]').trigger('click')
    expect(wrapper.findAll('[data-details]')).toHaveLength(1)
    await first.get('button[aria-expanded]').trigger('click')
    expect(wrapper.findAll('[data-details]')).toHaveLength(0)
    wrapper.unmount()
  })

  it('offers no details for a log that has none (ACME)', async () => {
    const { wrapper } = await mountLog('acme')
    await settled(wrapper)
    expect(quickActions(wrapper).props('details')).toBe(false)
    wrapper.unmount()
  })

  it('FR-032 shows a table with the time header sort on wide screens', async () => {
    const { wrapper, router } = await mountLog('legacy-ui-activity', { wide: true })
    await settled(wrapper)
    expect(wrapper.find('#operations-log-order').exists()).toBe(false)
    expect(wrapper.get('h1').text()).toMatch(/ UI$/)
    const sort = wrapper.get('[data-sort="time"]')
    await sort.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.order).toBe('asc')
    wrapper.unmount()
  })

  it('FR-040 shows debug.log_info with the configured length', async () => {
    const { wrapper } = await mountLog('logins')
    await waitFor(() => expect(wrapper.find('[data-log-info]').exists()).toBe(true))
    expect(wrapper.get('[data-log-info]').text()).toContain('LOG_LINES (10000)')
    wrapper.unmount()
  })

  it('Edge: an unknown log type shows "not found" with the way to the logs', async () => {
    const { wrapper } = await mountLog('unknown-log')
    expect(wrapper.find('h1').text()).toBe('Page not found')
    expect(wrapper.find('a').text()).toBe('Logs')
    expect(requestsOf('listPostfixLog')).toHaveLength(0)
    wrapper.unmount()
  })
})

describe('LogPage rate limit reset', () => {
  async function openRateLimits() {
    const mounted = await mountLog('rate-limits', { scenario: 'ops-rate-limits' })
    await settled(mounted.wrapper)
    return mounted
  }

  function removeButton(wrapper: VueWrapper) {
    return wrapper.findAll('button').find((button) => button.text().includes('Remove hash'))!
  }

  it('US3-AS9 asks with legacy texts, resets the bucket and refreshes the log', async () => {
    const { wrapper } = await openRateLimits()
    expect(wrapper.text()).toContain(
      'Removing a ratelimit hash (if still existing) will reset its counter completely.',
    )
    const before = requestsOf('listRateLimitLog').length
    await removeButton(wrapper).trigger('click')
    await waitFor(() => expect(confirmState.value).not.toBeNull())
    const request = confirmState.value!
    expect(request.title).toBe('Confirm deletion')
    expect(request.description).toBe('Please confirm your changes to the following object id')
    expect(request.confirmLabel).toBe('Delete now')
    expect(request.content?.props?.items).toEqual([expect.stringMatching(/^RLbucket\dhash$/)])
    expect(requestsOf('resetRateLimitBucket')).toHaveLength(0)
    settleConfirm(true)
    await waitFor(() => expect(requestsOf('resetRateLimitBucket')).toHaveLength(1))
    await waitFor(() =>
      expect(useStatusMessage().messages.value.map((message) => message.text)).toEqual([
        'Hash deleted',
      ]),
    )
    await waitFor(() => expect(requestsOf('listRateLimitLog').length).toBeGreaterThan(before))
    wrapper.unmount()
  })

  it('SC-007 sends nothing when the confirmation is cancelled', async () => {
    const { wrapper } = await openRateLimits()
    await removeButton(wrapper).trigger('click')
    await waitFor(() => expect(confirmState.value).not.toBeNull())
    settleConfirm(false)
    await flushPromises()
    expect(requestsOf('resetRateLimitBucket')).toHaveLength(0)
    wrapper.unmount()
  })

  it('a bucket already reset gives legacy\'s "not found" warning and refreshes', async () => {
    const { wrapper } = await openRateLimits()
    await removeButton(wrapper).trigger('click')
    await waitFor(() => expect(confirmState.value).not.toBeNull())
    const [hash] = confirmState.value!.content!.props!.items as string[]
    mockState().operations.logs.resetBuckets.push(hash!)
    settleConfirm(true)
    await waitFor(() =>
      expect(useStatusMessage().messages.value.map((message) => message.tone)).toEqual(['warning']),
    )
    expect(useStatusMessage().messages.value[0]!.text).toBe('Hash not found or already deleted')
    wrapper.unmount()
  })

  it('a refused reset shows the problem and changes nothing', async () => {
    const { wrapper } = await openRateLimits()
    mockState().operations.inject.resetRateLimitBucket = {
      status: 503,
      problemType: 'temporary-failure',
      extensions: { dependency: 'sharedStore' },
    }
    await removeButton(wrapper).trigger('click')
    await waitFor(() => expect(confirmState.value).not.toBeNull())
    settleConfirm(true)
    await waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))
    expect(wrapper.text()).toContain('Nothing was changed')
    expect(useStatusMessage().messages.value).toHaveLength(0)
    wrapper.unmount()
  })
})
