// UI 011 (FR-005, FR-010, FR-083, FR-084, research R7, T050): the live line chart is a figure with
// a caption and the current values in text, an SVG image with a title and a text summary, a dashed
// second series with a legend, a table alternative, "Loading..." until two samples exist, and no
// style attribute, transition or animation.
import { describe, expect, it } from 'vitest'

import LiveLineChart from '@/features/operations/charts/LiveLineChart.vue'

import { mountWithApp } from '../../../support/mount'

const samples = [
  { t: '2026-10-19T08:00:00Z', values: [12, 40] },
  { t: '2026-10-19T08:00:05Z', values: [48, 44] },
  { t: '2026-10-19T08:00:10Z', values: [31, 42] },
]

function chart(props: Record<string, unknown> = {}) {
  return mountWithApp(LiveLineChart, {
    props: {
      caption: 'Disk I/O',
      series: [{ name: 'Read' }, { name: 'Write' }],
      samples,
      kind: 'percent',
      ...props,
    },
  })
}

describe('LiveLineChart', () => {
  it('is a captioned figure with an SVG image, its title and a text summary', () => {
    const wrapper = chart()
    expect(wrapper.element.tagName).toBe('FIGURE')
    expect(wrapper.get('figcaption').text()).toBe('Disk I/O')
    const svg = wrapper.get('svg[role="img"]')
    const [title, desc] = svg.attributes('aria-labelledby')!.split(' ')
    expect(svg.get(`#${title}`).element.tagName).toBe('title')
    expect(svg.get(`#${desc}`).text()).toContain(
      'Read: 31% now, from 12% to 48% in the last 3 samples',
    )
    expect(svg.get(`#${desc}`).text()).toContain('Write: 42% now, from 40% to 44%')
  })

  it('shows the current values as text and distinguishes the series by pattern', () => {
    const wrapper = chart()
    expect(wrapper.get('[data-current]').text()).toContain('Read')
    expect(wrapper.get('[data-current]').text()).toContain('31%')
    const lines = wrapper.findAll('polyline[data-series]')
    expect(lines).toHaveLength(2)
    expect(lines[0]!.attributes('stroke-dasharray')).toBeUndefined()
    expect(lines[1]!.attributes('stroke-dasharray')).toBeTruthy()
    expect(wrapper.findAll('[data-legend] li')).toHaveLength(2)
  })

  it('offers the values as a table with header cells and a caption', async () => {
    const wrapper = chart()
    const toggle = wrapper.get('button[aria-expanded]')
    expect(toggle.text()).toBe('Show the values as a table')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(toggle.text()).toBe('Hide the table')
    const table = wrapper.get('table')
    expect(table.get('caption').text()).toBe('Disk I/O')
    expect(table.findAll('thead th').map((th) => th.text())).toEqual(['Time', 'Read', 'Write'])
    expect(table.findAll('tbody tr')).toHaveLength(3)
    expect(table.findAll('tbody th[scope="row"]')).toHaveLength(3)
  })

  it('says Loading... until two samples with values exist', () => {
    expect(chart({ samples: samples.slice(0, 1) }).text()).toContain('Loading...')
    const nulls = [
      { t: '2026-10-19T08:00:00Z', values: [null, null] },
      { t: '2026-10-19T08:00:05Z', values: [1024, 512] },
    ]
    const wrapper = chart({ samples: nulls, kind: 'rate' })
    expect(wrapper.text()).toContain('Loading...')
    expect(wrapper.find('svg').exists()).toBe(false)
  })

  it('formats rates in binary units per second', () => {
    const rates = [
      { t: '2026-10-19T08:00:00Z', values: [1024, 2048] },
      { t: '2026-10-19T08:00:05Z', values: [1536, 512] },
    ]
    expect(chart({ samples: rates, kind: 'rate' }).get('[data-current]').text()).toContain(
      '1.5 KiB/s',
    )
  })

  it('has no style attribute and no transition or animation', () => {
    const html = chart().html()
    expect(html).not.toMatch(/style="/)
    expect(html).not.toMatch(/transition|animate/)
  })
})
