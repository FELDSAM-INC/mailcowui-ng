// Purposes of diagnostics checks (T056, research R15): every identifier of the contract, the DKIM
// selector, the services, and the generic label of an unknown identifier with its record type.
import { describe, expect, it } from 'vitest'

import { checkLabel } from '@/features/dns/diagnostics/check-labels'
import { i18n } from '@/i18n'

const label = (id: string, recordType = 'TXT') => {
  const view = checkLabel({ id, recordType: recordType as 'TXT' })
  return i18n.global.t(view.key, view.params)
}

describe('checkLabel', () => {
  it.each([
    ['a', 'Server address (IPv4)'],
    ['ptr:ipv4', 'Reverse name (IPv4)'],
    ['aaaa', 'Server address (IPv6)'],
    ['ptr:ipv6', 'Reverse name (IPv6)'],
    ['tlsa:25', 'TLSA for SMTP (port 25)'],
    ['mx', 'Mail exchanger'],
    ['autodiscover', 'Autodiscover'],
    ['srv:autodiscover', 'Autodiscover service'],
    ['autoconfig', 'Autoconfig'],
    ['mta-sts', 'MTA-STS host'],
    ['mta-sts-record', 'MTA-STS record'],
    ['tls-rpt', 'TLS reporting'],
    ['spf', 'SPF'],
    ['dmarc', 'DMARC'],
    ['dkim', 'DKIM'],
  ])('labels %s', (id, expected) => {
    expect(label(id)).toBe(expected)
  })

  it('names the DKIM selector and the services', () => {
    expect(label('dkim:feldhost')).toBe('DKIM (selector feldhost)')
    expect(label('srv:imaps', 'SRV')).toBe('IMAPS service')
    expect(label('srv:submission', 'SRV')).toBe('Submission service')
    expect(label('srv:sieve', 'SRV')).toBe('Sieve service')
  })

  it('labels an unknown identifier by its record type', () => {
    expect(label('caa', 'TXT')).toBe('TXT record')
    expect(label('srv:gopher', 'SRV')).toBe('SRV record')
  })
})
