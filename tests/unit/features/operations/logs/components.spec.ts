// UI 011 (FR-030 to FR-034, FR-085, T076; plan decisions 2, 5, 10, 12 and 24): the log choice,
// the entries as cards and as a table with legacy's columns, values as text, details in place and
// the rate limit reset only for a bucket hash.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { RateLimitLogEntry } from '@/api'
import LogCellView from '@/features/operations/logs/components/LogCellView.vue'
import LogEntryList from '@/features/operations/logs/components/LogEntryList.vue'
import LogTypeSelect from '@/features/operations/logs/components/LogTypeSelect.vue'
import { findLogType, type LogEntry } from '@/features/operations/logs/log-types'

import { logEntry, LONG_TOKEN } from '../../../../mocks/factories/log-entry'
import { mountWithApp } from '../../../support/mount'
import { createTestRouter } from '../../../support/router'

const BASE = Date.parse('2026-10-19T08:00:00Z')

function list(slug: string, entries: LogEntry[], props: Record<string, unknown> = {}) {
  return mountWithApp(LogEntryList, {
    props: {
      type: findLogType(slug)!,
      title: slug,
      entries,
      expanded: new Set<string>(),
      wide: false,
      order: 'desc',
      ...props,
    },
  })
}

describe('LogTypeSelect', () => {
  it("offers legacy's groups and log names in legacy order, and opens the chosen log", async () => {
    const router = createTestRouter()
    await router.push('/operations/logs/postfix')
    await router.isReady()
    const wrapper = mountWithApp(LogTypeSelect, {
      props: { current: 'postfix' },
      global: { plugins: [router] },
    })
    expect(wrapper.get('label').text()).toBe('Logs')
    const groups = wrapper.findAll('optgroup')
    expect(groups.map((group) => group.attributes('label'))).toEqual([
      'In-memory logs',
      'External logs',
      'Static logs',
    ])
    expect(groups[0]!.findAll('option').map((option) => option.text())).toEqual([
      'Postfix',
      'Dovecot',
      'SOGo',
      'Netfilter',
      'Autodiscover',
      'Watchdog',
      'ACME',
      'API',
      'Ratelimits',
      'Crontasks',
    ])
    expect(groups[1]!.text()).toBe('Rspamd')
    expect(groups[2]!.findAll('option').map((option) => option.text())[1]).toBe('SASL')
    expect(groups[2]!.findAll('option')[0]!.text()).toMatch(/ UI$/)
    await wrapper.get('select').setValue('rspamd')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('operations-rspamd')
    await wrapper.setProps({ current: 'rspamd' })
    await wrapper.get('select').setValue('cron')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/operations/logs/cron')
  })
})

describe('LogCellView', () => {
  it('shows the priority as stored with its class as icon and colour', () => {
    const wrapper = mountWithApp(LogCellView, {
      props: { cell: { kind: 'priority', value: 'crit', severity: 'error' } },
    })
    expect(wrapper.text()).toBe('crit')
    expect(wrapper.attributes('data-severity')).toBe('error')
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('shows the watchdog change with its sign', () => {
    const up = mountWithApp(LogCellView, { props: { cell: { kind: 'trend', value: 2 } } })
    expect(up.text()).toBe('+2')
    const down = mountWithApp(LogCellView, { props: { cell: { kind: 'trend', value: -3 } } })
    expect(down.text()).toBe('-3')
  })

  it("shows legacy's placeholders and never interprets markup", () => {
    const missing = mountWithApp(LogCellView, {
      props: { cell: { kind: 'text', value: null, fallback: { key: 'operations.logs.unknown' } } },
    })
    expect(missing.text()).toBe('unknown')
    const markup = mountWithApp(LogCellView, {
      props: { cell: { kind: 'multiline', value: '<img src=x onerror=alert(1)>‮line' } },
    })
    expect(markup.find('img').exists()).toBe(false)
    expect(markup.find('[data-marker]').text()).toBe('U+202E')
  })

  it('offers "Remove hash" only for a bucket hash', () => {
    const valid = mountWithApp(LogCellView, {
      props: { cell: { kind: 'reset', hash: 'RLbucket1hash' } },
    })
    expect(valid.get('button').text()).toBe('Remove hash')
    const none = mountWithApp(LogCellView, { props: { cell: { kind: 'reset', hash: null } } })
    expect(none.find('button').exists()).toBe(false)
  })
})

describe('LogEntryList', () => {
  it('shows each entry as a card with its time and class first and its message below', () => {
    const entry = logEntry('postfix', 3, BASE)
    const wrapper = list('postfix', [entry])
    const card = wrapper.get(`[data-entry="${entry.id}"]`)
    expect(card.get('[data-cell="time"] time').attributes('datetime')).toBe(entry.time)
    expect(card.get('[data-cell="priority"]').text()).toContain(entry.priority)
    expect(card.get('[data-cell="message"]').text()).toBe(LONG_TOKEN)
    expect(card.find('[aria-expanded]').exists()).toBe(false)
  })

  it('opens the details of a card in place', async () => {
    const entry = logEntry('autodiscover', 4, BASE)
    const wrapper = list('autodiscover', [entry])
    const toggle = wrapper.get('[aria-expanded]')
    expect(toggle.text()).toBe('Show details')
    await toggle.trigger('click')
    expect(wrapper.emitted('toggle')).toEqual([[entry.id]])
    await wrapper.setProps({ expanded: new Set([entry.id]) })
    const details = wrapper.get('[data-details]')
    expect(details.findAll('dt').map((term) => term.text())).toEqual(['User-Agent', 'IP'])
    expect(details.get('[data-cell="userAgent"]').text()).toBe('unknown')
    expect(wrapper.get('[aria-expanded]').attributes('aria-controls')).toBe(
      details.attributes('id'),
    )
  })

  it("shows legacy's table columns from md, with the time column sorting", async () => {
    const entry: RateLimitLogEntry = logEntry('rate-limits', 7, BASE)
    const wrapper = list('rate-limits', [entry], { wide: true })
    const headers = wrapper.findAll('th').map((header) => header.text().replace(/[▲▼]/g, '').trim())
    expect(headers).toEqual(['Time', 'Rate name', 'Sender', 'Recipients', 'Auth. user', 'Action'])
    expect(wrapper.get('th[aria-sort]').attributes('aria-sort')).toBe('descending')
    await wrapper.get('[data-sort-time]').trigger('click')
    expect(wrapper.emitted('sort')).toEqual([['asc']])
    const row = wrapper.get(`[data-entry="${entry.id}"]`)
    expect(
      row
        .get('td')
        .classes()
        .some((name) => name.startsWith('border-s-')),
    ).toBe(true)
    await row.get('[data-reset]').trigger('click')
    expect(wrapper.emitted('reset')).toEqual([[entry.rateLimitHash]])
    await wrapper.setProps({ expanded: new Set([entry.id]) })
    expect(
      wrapper
        .get('[data-details]')
        .findAll('dt')
        .map((term) => term.text()),
    ).toEqual(['Msg ID', 'Header From', 'Subject', 'Hash', 'Rspamd QID', 'IP'])
  })

  it('shows "err" for a missing hash and offers no reset', async () => {
    const entry: RateLimitLogEntry = { ...logEntry('rate-limits', 5, BASE), rateLimitHash: null }
    const wrapper = list('rate-limits', [entry], { wide: true, expanded: new Set([entry.id]) })
    expect(wrapper.get('[data-details] [data-cell="hash"]').text()).toBe('err')
    expect(wrapper.find('[data-reset]').exists()).toBe(false)
    await wrapper.setProps({ wide: false })
    expect(wrapper.get('[data-details] [data-cell="user"]').text()).toBe('none')
  })

  it('keeps the UI activity call in the details and shows the message key with its parameters', () => {
    const entry = logEntry('legacy-ui-activity', 1, BASE)
    const wrapper = list('legacy-ui-activity', [entry], {
      wide: true,
      expanded: new Set([entry.id]),
    })
    expect(wrapper.get('[data-cell="message"]').text()).toBe(
      'object_modified ["alice@example.org"]',
    )
    expect(wrapper.get('[data-details] [data-cell="call"]').text()).toContain('"password": "*"')
  })
})
