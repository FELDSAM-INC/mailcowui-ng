// Diagnostics messages (T056, research R15): every code with its parameters formatted per locale,
// lists with Intl.ListFormat, translated causes, values shown verbatim, `url` only as a separate
// link through safeHref, and an unknown code with the API's English text.
import { describe, expect, it } from 'vitest'

import { dnsCheckMessageCodeValues, type DnsCheckMessageCode } from '@/api'
import { messageView } from '@/features/dns/diagnostics/check-messages'
import { i18n, loadLocale, text } from '@/i18n'

import { MESSAGE_PARAMS, message } from '../../../mocks/factories/dns-diagnostics'

const render = (code: DnsCheckMessageCode, params?: Record<string, unknown>) => {
  const view = messageView(message(code, params), 'en-gb')
  return { view, text: text(view.key, view.params) }
}

describe('messageView', () => {
  it.each(dnsCheckMessageCodeValues)(
    'translates %s without leaving a key or a placeholder',
    (code) => {
      const { view, text: shown } = render(code)
      expect(view.englishFallback).toBeNull()
      expect(shown).not.toMatch(/dns\.diagnostics|\{[a-z]+\}/i)
      expect(shown.length).toBeGreaterThan(0)
    },
  )

  it('formats numbers and translates the cause', () => {
    expect(render('lookupTimeout', { timeoutSeconds: 5 }).text).toContain('5')
    const certificate = render('certificateUnavailable', {
      host: 'mail.example.org',
      port: 25,
      cause: 'starttlsRefused',
    })
    expect(certificate.text).toContain('mail.example.org')
    expect(certificate.text).toContain('25')
    expect(certificate.text).toContain('STARTTLS')
    expect(render('spfTooManyLookups', { limit: 10 }).text).toContain('10')
  })

  it('keeps an unknown cause as it is', () => {
    expect(
      render('certificateUnavailable', { host: 'h', port: 25, cause: 'cosmicRays' }).text,
    ).toContain('cosmicRays')
  })

  it('formats numbers in the locale', async () => {
    await loadLocale(i18n, 'cs-cz')
    const view = messageView(message('spfMultipleRecords', { count: 1200 }), 'cs-cz')
    expect(view.params.count).toMatch(/1\s200/)
  })

  it('lists addresses with Intl.ListFormat and keeps them as values', () => {
    const view = messageView(
      message('matchedByAddressRecords', { ipv4: ['192.0.2.25', '192.0.2.26'], ipv6: [] }),
      'en-gb',
    )
    expect(view.values).toEqual(['192.0.2.25', '192.0.2.26'])
    expect(view.params.ipv4).toBe('192.0.2.25 and 192.0.2.26')
  })

  it('gives the SPF addresses and the suggested record as copyable values', () => {
    const allow = messageView(
      message('spfAuthorizeAddresses', { ipv4: '192.0.2.25', ipv6: null }),
      'en-gb',
    )
    expect(allow.values).toEqual(['ip4:192.0.2.25'])
    const both = messageView(
      message('spfAuthorizeAddresses', MESSAGE_PARAMS.spfAuthorizeAddresses),
      'en-gb',
    )
    expect(both.values).toEqual(['ip4:192.0.2.25', 'ip6:2001:db8::25'])
    const record = messageView(
      message('spfSuggestedRecord', { record: 'v=spf1 mx a ~all' }),
      'en-gb',
    )
    expect(record.values).toEqual(['v=spf1 mx a ~all'])
  })

  it('turns a url into a separate link, only when safeHref accepts it', () => {
    const safe = messageView(
      message('dmarcPublishPolicy', { url: 'https://dmarc.org/overview/' }),
      'en-gb',
    )
    expect(safe.link).toBe('https://dmarc.org/overview/')
    expect(text(safe.key, safe.params)).not.toContain('https://')
    const unsafe = messageView(
      message('spfSyntaxReference', { url: 'javascript:alert(1)' }),
      'en-gb',
    )
    expect(unsafe.link).toBeNull()
  })

  it('shows an unknown code with the API English text', () => {
    const view = messageView(
      { code: 'quantumEntanglement' as DnsCheckMessageCode, params: {}, message: 'Spooky action.' },
      'en-gb',
    )
    expect(view.key).toBe('dns.diagnostics.messages.unknown')
    expect(view.englishFallback).toBe('Spooky action.')
    expect(text(view.key)).toContain('in English')
  })

  it('uses the classic texts of the address records note and the propagation notice', () => {
    expect(render('matchedByAddressRecords').text).toContain('Value derived from A/AAAA record')
    expect(render('propagationDelay').text).toContain('24 hours')
  })
})
