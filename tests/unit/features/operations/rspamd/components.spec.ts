// UI 011 (FR-045 to FR-048, FR-083, T119, T120; plan decisions 12 and 19): the per-action bars of
// Rspamd's statistics with their summary and table, and the scan history entries with the score
// against the required score in text, the symbols in the API's order and legacy's placeholders.
import { describe, expect, it } from 'vitest'

import RspamdActionsChart from '@/features/operations/rspamd/components/RspamdActionsChart.vue'
import RspamdHistoryList from '@/features/operations/rspamd/components/RspamdHistoryList.vue'

import { rejectedEntry, rspamdHistory, rspamdStatistics } from '../../../../mocks/factories/rspamd'
import { mountWithApp } from '../../../support/mount'

const statistics = rspamdStatistics('2026-10-19T08:00:00Z')

describe('RspamdActionsChart', () => {
  it('shows one labelled bar per action as Rspamd names it, with count and share in text', () => {
    const wrapper = mountWithApp(RspamdActionsChart, { props: { statistics } })
    const rows = wrapper.findAll('[data-action]')
    expect(rows.map((row) => row.attributes('data-action'))).toEqual([
      'no action',
      'add header',
      'rewrite subject',
      'greylist',
      'soft reject',
      'reject',
    ])
    expect(rows[0]!.text()).toContain('no action 82%')
    expect(rows[0]!.text()).toContain('820 messages')
    expect(rows[5]!.text()).toContain('reject 3%')
    const bar = rows[0]!.get('[data-bar]')
    expect(bar.attributes('aria-hidden')).toBe('true')
    expect(bar.attributes('style')).toContain('width: 82%')
    expect(wrapper.get('[data-summary]').text()).toBe(
      'Most messages (82%) got the action no action.',
    )
  })

  it('offers the same figures as a table', async () => {
    const wrapper = mountWithApp(RspamdActionsChart, { props: { statistics } })
    const toggle = wrapper.get('button[aria-expanded]')
    expect(toggle.text()).toBe('Show the values as a table')
    expect(wrapper.find('table').exists()).toBe(false)
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(toggle.text()).toBe('Hide the table')
    const table = wrapper.get('table')
    expect(table.get('caption').text()).toBe('Chart (this server)')
    expect(table.findAll('th[scope="col"]').map((cell) => cell.text())).toEqual([
      'Action',
      'Messages',
      'Share',
    ])
    expect(
      table
        .findAll('tbody tr')[3]!
        .findAll('th, td')
        .map((cell) => cell.text()),
    ).toEqual(['greylist', '40', '4%'])
  })

  it('says that no message was scanned yet when every count is zero', () => {
    const wrapper = mountWithApp(RspamdActionsChart, {
      props: { statistics: rspamdStatistics('2026-10-19T08:00:00Z', true) },
    })
    expect(wrapper.text()).toBe('No messages were scanned yet.')
    expect(wrapper.find('[data-action]').exists()).toBe(false)
  })
})

describe('RspamdHistoryList', () => {
  const rejected = rejectedEntry('2026-10-19T07:59:30Z')

  it('shows the action, the score against the required score and the senders as text', async () => {
    const wrapper = mountWithApp(RspamdHistoryList, {
      props: {
        entries: [rejected],
        expanded: new Set<string>(),
        wide: false,
        sort: 'time',
        order: 'desc',
      },
    })
    const card = wrapper.get('[data-entry]')
    expect(card.get('[data-cell="action"]').text()).toBe('reject')
    expect(card.get('[data-cell="score"]').text()).toBe('18.37 / 15 above the required score')
    expect(card.get('[data-cell="from"]').text()).toBe('Totally Legit <spammer@example.net>')
    expect(card.get('[data-cell="subject"]').text()).toBe('You won <b>1,000,000</b>')
    expect(card.find('b').exists()).toBe(false)
    await wrapper.setProps({
      expanded: new Set([wrapper.get('[data-entry]').attributes('data-entry')!]),
    })
    const symbols = wrapper.findAll('[data-symbol]').map((symbol) => symbol.text())
    expect(symbols).toEqual([
      'BAYES_SPAM (5.1) [99.99%]',
      'RBL_SPAMHAUS (4) [66.113.0.203.zen.spamhaus.org]',
      'DMARC_POLICY_ALLOW (-0.5) [example.net, none]',
      'ARC_NA (0)',
    ])
    expect(wrapper.get('[data-details] [data-cell="user"]').text()).toBe('none')
    expect(wrapper.get('[data-details] [data-cell="scanTime"]').text()).toBe('0.412 / 0.050')
  })

  it("shows legacy's table columns with sortable time, score, size and scan time", async () => {
    const entries = rspamdHistory(2, Date.parse('2026-10-19T08:00:00Z'))
    const wrapper = mountWithApp(RspamdHistoryList, {
      props: { entries, expanded: new Set<string>(), wide: true, sort: 'score', order: 'asc' },
    })
    const headers = wrapper
      .findAll('thead th')
      .map((cell) => cell.text().replace(/[▲▼]/g, '').trim())
    expect(headers).toEqual([
      'Time',
      'IP address',
      'From',
      'To',
      'Subject',
      'Action',
      'Score',
      'Msg size',
      'Scan Time',
    ])
    expect(wrapper.findAll('th[aria-sort]').map((cell) => cell.attributes('aria-sort'))).toEqual([
      'none',
      'ascending',
      'none',
      'none',
    ])
    await wrapper.get('[data-sort="size"]').trigger('click')
    expect(wrapper.emitted('sort')).toEqual([['size', 'asc']])
    await wrapper.get('[data-sort="score"]').trigger('click')
    expect(wrapper.emitted('sort')![1]).toEqual(['score', 'desc'])
    expect(wrapper.get('[data-entry] [data-cell="score"]').text()).toContain(
      'below the required score',
    )
  })
})
