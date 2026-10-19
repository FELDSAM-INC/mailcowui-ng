// The DKIM DNS publication outcome (T017, research R16, FR-043, FR-044): nothing while publication
// is off; every status with its label, icon and advice; a failed one with its translated reason,
// an unknown reason code as the generic failure, and the technical detail as English text.
import { describe, expect, it } from 'vitest'

import {
  dkimDnsPublicationReasonCodeValues,
  dkimDnsPublicationStatusValues,
  type DkimDnsPublicationOutcome,
} from '@/api'
import PublicationOutcome from '@/features/dns/components/PublicationOutcome.vue'

import { mountWithApp } from '../../support/mount'

function outcome(overrides: Partial<DkimDnsPublicationOutcome> = {}): DkimDnsPublicationOutcome {
  return {
    status: 'published',
    recordName: 'dkim._domainkey.example.org',
    reason: null,
    ...overrides,
  }
}

const mountOutcome = (value: DkimDnsPublicationOutcome, enabled = true) =>
  mountWithApp(PublicationOutcome, {
    props: { outcome: value, enabled },
    slots: { action: '<button type="button">Publish again</button>' },
  })

describe('PublicationOutcome', () => {
  it('renders nothing while publication is off', () => {
    const wrapper = mountOutcome(outcome(), false)
    expect(wrapper.find('[data-publication-outcome]').exists()).toBe(false)
  })

  it.each(dkimDnsPublicationStatusValues)(
    'labels the status %s with text and an icon',
    (status) => {
      const wrapper = mountOutcome(
        outcome({ status, reason: status === 'failed' ? { code: 'timeout', detail: null } : null }),
      )
      const root = wrapper.get('[data-publication-outcome]')
      expect(root.attributes('data-status')).toBe(status)
      expect(root.text()).not.toContain('dns.publication')
      expect(root.find('svg[aria-hidden="true"]').exists()).toBe(true)
    },
  )

  it('says to publish manually for noZone and offers the action', () => {
    const wrapper = mountOutcome(outcome({ status: 'noZone' }))
    expect(wrapper.text()).toContain('No DNS zone was found for this name')
    expect(wrapper.text()).toContain('Publish the record manually')
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it.each(dkimDnsPublicationReasonCodeValues)('translates the failure reason %s', (code) => {
    const wrapper = mountOutcome(outcome({ status: 'failed', reason: { code, detail: null } }))
    expect(wrapper.text()).toContain('Not published')
    expect(wrapper.text()).toContain('The key works')
    expect(wrapper.get('[data-publication-reason]').text()).not.toContain('dns.publication')
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('shows an unknown reason code as the generic failure', () => {
    const wrapper = mountOutcome(
      outcome({
        status: 'failed',
        reason: { code: 'somethingNew' as never, detail: null },
      }),
    )
    expect(wrapper.get('[data-publication-reason]').text()).toBe(
      'The DNS server reported an unexpected problem.',
    )
  })

  it('shows the technical detail as plain English text', () => {
    const wrapper = mountOutcome(
      outcome({
        status: 'failed',
        reason: { code: 'remoteFault', detail: '<b>SOAP fault</b> zone locked' },
      }),
    )
    const detail = wrapper.get('[data-publication-detail]')
    expect(detail.attributes('lang')).toBe('en')
    expect(detail.text()).toBe('<b>SOAP fault</b> zone locked')
    expect(detail.find('b').exists()).toBe(false)
    expect(wrapper.text()).toContain('Technical detail')
  })

  it('offers no action for a published record', () => {
    expect(mountOutcome(outcome()).find('button').exists()).toBe(false)
  })
})
