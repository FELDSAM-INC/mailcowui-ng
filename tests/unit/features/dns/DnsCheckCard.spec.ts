// A diagnostics check as a card (T057, FR-059, FR-061, FR-078): the purpose as heading, the record
// name and type, the status as icon and text, the optional marker, the expected value or the
// guidance, the values found as literal text, reasons and notes; copy buttons for the record name
// and the expected value only.
import { describe, expect, it } from 'vitest'

import DnsCheckCard from '@/features/dns/components/DnsCheckCard.vue'
import CopyButton from '@/shared/components/CopyButton.vue'

import { mountWithApp } from '../../support/mount'
import { check, checkOfStatus, message } from './diagnostics-fixtures'

describe('DnsCheckCard', () => {
  it('shows a matching MX check with its copy buttons', () => {
    const wrapper = mountWithApp(DnsCheckCard, { props: { check: check() } })
    expect(wrapper.element.tagName).toBe('LI')
    expect(wrapper.get('h3').text()).toBe('Mail exchanger')
    expect(wrapper.text()).toContain('example.org')
    expect(wrapper.text()).toContain('MX')
    expect(wrapper.get('[data-check-status]').text()).toContain('Correct')
    expect(wrapper.get('[data-check-status] svg').attributes('aria-hidden')).toBe('true')
    const labels = wrapper.findAllComponents(CopyButton).map((button) => button.props('label'))
    expect(labels).toEqual([
      'Copy record name of Mail exchanger',
      'Copy expected value of Mail exchanger',
    ])
    expect(wrapper.get('[data-check-found]').text()).toContain('mail.example.org')
  })

  it('marks an optional check, shows guidance instead of an expected value, and a learn-more link', () => {
    const dmarc = checkOfStatus('missing', true)
    const wrapper = mountWithApp(DnsCheckCard, {
      props: {
        check: {
          ...dmarc,
          id: 'dmarc',
          recordType: 'TXT',
          recordName: '_dmarc.example.org',
          expected: null,
          guidance: [message('dmarcPublishPolicy')],
        },
      },
    })
    expect(wrapper.get('[data-check-status]').text()).toContain('Not set (optional)')
    expect(wrapper.text()).toContain('This record is optional.')
    expect(wrapper.text()).toContain('Publish a DMARC policy for this name.')
    const link = wrapper.get('a[target="_blank"]')
    expect(link.attributes('href')).toBe('https://dmarc.org/overview/')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
    expect(wrapper.get('[data-check-found]').text()).toBe('No record found')
    expect(wrapper.findAllComponents(CopyButton)).toHaveLength(1)
  })

  it('shows markup and bidi controls in found values literally', () => {
    const wrapper = mountWithApp(DnsCheckCard, {
      props: {
        check: check({
          status: 'mismatch',
          found: ['<script>alert(1)</script>', 'mail.example.org‮evil.example', 'mx2'],
        }),
      },
    })
    const found = wrapper.get('[data-check-found]')
    expect(found.find('script').exists()).toBe(false)
    expect(found.text()).toContain('<script>alert(1)</script>')
    expect(found.text()).toContain('mail.example.org\\u{202E}evil.example')
    expect(found.findAll('code')).toHaveLength(3)
  })

  it('translates the reason and notes, and the SPF guidance with copyable values', () => {
    const wrapper = mountWithApp(DnsCheckCard, {
      props: {
        check: check({
          id: 'spf',
          recordType: 'TXT',
          status: 'mismatch',
          optional: true,
          expected: null,
          found: ['v=spf1 -all'],
          reason: message('spfNotPass', { address: '192.0.2.25', result: 'fail' }),
          guidance: [
            message('spfAuthorizeAddresses', { ipv4: '192.0.2.25', ipv6: '2001:db8::25' }),
            message('spfSuggestedRecord', { record: 'v=spf1 mx a ~all' }),
          ],
          notes: [message('matchedByAddressRecords', { ipv4: ['192.0.2.25'], ipv6: [] })],
        }),
      },
    })
    expect(wrapper.text()).toContain('does not authorise the server address 192.0.2.25')
    expect(wrapper.text()).toContain('Value derived from A/AAAA record')
    expect(wrapper.text()).toContain('Make sure the MX records point to this server.')
    const values = wrapper.findAllComponents(CopyButton).map((button) => button.props('text'))
    expect(values).toContain('v=spf1 mx -all')
    expect(values).not.toContain('ip4:192.0.2.25')
    expect(values).not.toContain('ip6:2001:db8::25')
  })

  it('shows an unknown message code with the English text', () => {
    const wrapper = mountWithApp(DnsCheckCard, {
      props: {
        check: check({
          status: 'lookupFailed',
          found: [],
          reason: { code: 'cosmicRays' as never, params: {}, message: 'Bit flip.' },
        }),
      },
    })
    expect(wrapper.text()).toContain('Further detail, in English:')
    expect(wrapper.get('[lang="en"]').text()).toBe('Bit flip.')
  })
})
