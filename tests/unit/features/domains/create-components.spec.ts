// The outcomes of a creation on the domain page (UI 002 T048, FR-026), as the classic alerts.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import CreationReport from '@/features/domains/components/detail/CreationReport.vue'
import * as announcer from '@/shared/composables/useAnnouncer'

import { mountWithApp } from '../../support/mount'

describe('CreationReport', () => {
  it("shows one alert per outcome with legacy's text, announces them and can be closed", async () => {
    const announce = vi.spyOn(announcer, 'announce')
    const wrapper = mountWithApp(CreationReport, {
      props: {
        name: 'mixed.example',
        report: {
          rateLimit: 'notRequested',
          dkimKey: 'alreadyExisted',
          dkimDnsPublication: 'skipped',
          groupwareRestart: 'failed',
          messages: { groupwareRestart: 'English, never shown' },
        },
      },
    })
    const alerts = wrapper.findAll('[data-alert]')
    expect(alerts.map((alert) => [alert.attributes('data-alert'), alert.text()])).toEqual([
      ['success', 'A DKIM key did already exist'],
      ['warning', 'Added domain but failed to restart SOGo, please check your server logs.'],
    ])
    for (const alert of alerts) expect(alert.find('svg').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('English, never shown')
    await flushPromises()
    expect(announce.mock.calls.at(-1)![0]).toContain('A DKIM key did already exist')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })

  it('says "Added domain …" with the domain name', () => {
    const wrapper = mountWithApp(CreationReport, {
      props: {
        name: 'new.example',
        report: {
          rateLimit: 'notRequested',
          dkimKey: 'notRequested',
          dkimDnsPublication: 'skipped',
          groupwareRestart: 'notRequested',
        },
      },
    })
    expect(wrapper.text()).toContain('Added domain new.example')
  })
})
