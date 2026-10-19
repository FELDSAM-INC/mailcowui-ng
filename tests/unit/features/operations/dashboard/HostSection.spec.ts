// UI 011 (FR-004–FR-007, FR-025, T051): the host card in legacy order, the host's time in its own
// time zone, the uptime in words, the disk usage, and one failing read that hides nothing else.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import HostSection from '@/features/operations/dashboard/components/HostSection.vue'

import { useScenario } from '../../../../mocks/node'
import { mountWithApp } from '../../../support/mount'
import { createTestRouter } from '../../../support/router'
import { overview, storage } from './helpers'

async function mountHost(props: Record<string, unknown> = {}) {
  useScenario('admin-operations')
  const router = createTestRouter()
  const wrapper = mountWithApp(HostSection, {
    props: {
      overview,
      overviewFailed: false,
      storage,
      storageFailed: false,
      ipCheckEnabled: true,
      cpuSamples: [],
      memorySamples: [],
      ...props,
    },
    global: { plugins: [router] },
  })
  await flushPromises()
  return wrapper
}

describe('HostSection', () => {
  it('lists the rows in legacy order', async () => {
    const wrapper = await mountHost()
    expect(wrapper.findAll('dt').map((term) => term.text())).toEqual([
      'Hostname',
      'Architecture',
      'IPs',
      'Version',
      'System Time',
      'Timezone',
      'Uptime',
      'Disk usage',
    ])
    expect(wrapper.get('[data-hostname]').text()).toBe('mail.example.org')
    expect(wrapper.get('[data-architecture]').text()).toBe('x86_64')
  })

  it("shows the host's time in its time zone, the zone and the uptime in words", async () => {
    const wrapper = await mountHost()
    expect(wrapper.get('[data-host-time]').text()).toContain('10:00:00')
    expect(wrapper.get('[data-time-zone]').text()).toBe('Europe/Prague')
    expect(wrapper.get('[data-uptime]').text().replace(/\s/g, ' ')).toBe(
      '3 days, 4 hours, 5 minutes',
    )
  })

  it('shows the disk usage in binary units with a labelled bar', async () => {
    const wrapper = await mountHost()
    const disk = wrapper.get('[data-mail-storage]')
    expect(disk.text()).toContain('/dev/sda1')
    expect(disk.text()).toContain('42 GiB / 100 GiB (42%)')
    const bar = disk.get('[role="progressbar"]')
    expect(bar.attributes('aria-label')).toBe('Disk usage')
    expect(bar.attributes('aria-valuenow')).toBe('42')
  })

  it('says "Unavailable" and never zeros for an unmeasured storage', async () => {
    const wrapper = await mountHost({
      storage: {
        ...storage,
        measured: false,
        usedBytes: null,
        totalBytes: null,
        usedPercent: null,
      },
    })
    expect(wrapper.get('[data-unavailable]').text()).toBe('Unavailable')
    expect(wrapper.get('[data-mail-storage]').text()).not.toMatch(/0 B|0%/)
  })

  it('keeps the IPs, the version and the disk usage when the overview fails', async () => {
    const wrapper = await mountHost({ overview: undefined, overviewFailed: true })
    expect(wrapper.find('[data-overview-error]').exists()).toBe(true)
    expect(wrapper.findAll('dt').map((term) => term.text())).toEqual([
      'IPs',
      'Version',
      'Disk usage',
    ])
    expect(wrapper.find('[data-cpu-memory]').exists()).toBe(false)
  })

  it('shows the CPU and memory figures before the chart chunk resolves', async () => {
    const wrapper = await mountHost()
    expect(wrapper.get('[data-cpu]').text().replace(/\s+/g, ' ')).toBe('4 Cores @ 12%')
    expect(wrapper.get('[data-memory]').text().replace(/\s+/g, ' ')).toBe('8 GiB @ 41%')
    expect(wrapper.findAll('h3').map((heading) => heading.text())).toEqual(['CPU', 'Memory'])
  })
})
