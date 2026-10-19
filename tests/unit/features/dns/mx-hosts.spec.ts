// The MTA-STS MX hosts (T067, settled deviation 4: the classic comma-separated text area): entries
// split on commas, trimmed, one trailing dot removed, case-only duplicates kept once with the first
// spelling, each checked as a host name (with `*.`), the joined ASCII length against the limit,
// and server error paths `mxHosts.<i>` mapped to the entries.
import { describe, expect, it } from 'vitest'

import {
  formatMxHosts,
  joinedLength,
  nearLimit,
  parseMxHosts,
  validateMxHosts,
} from '@/features/dns/mta-sts/mx-hosts'

describe('MX hosts', () => {
  it('splits, trims, removes one trailing dot and keeps case-only duplicates once', () => {
    expect(parseMxHosts(' Mail.Example.org. , mx2.example.org,,mail.example.org ')).toEqual({
      hosts: ['Mail.Example.org', 'mx2.example.org'],
      duplicates: ['mail.example.org'],
    })
    expect(parseMxHosts('')).toEqual({ hosts: [], duplicates: [] })
    expect(parseMxHosts('*.example.org')).toEqual({ hosts: ['*.example.org'], duplicates: [] })
  })

  it('measures the joined ASCII length and says when 90 % is reached', () => {
    expect(joinedLength(['bücher.example', 'a.example'])).toBe(
      'xn--bcher-kva.example,a.example'.length,
    )
    expect(nearLimit(229, 255)).toBe(false)
    expect(nearLimit(230, 255)).toBe(true)
  })

  it('names invalid entries by their position, and the list rules on the field', () => {
    expect(validateMxHosts(['mail.example.org', 'mail..example'], 255, 128)).toEqual({
      'mxHosts.1': [{ key: { legacy: 'danger.mx_invalid', args: ['mail..example'] } }],
    })
    expect(validateMxHosts([], 255, 128)).toEqual({
      mxHosts: [{ key: 'validation.required' }],
    })
    const long = Array.from({ length: 30 }, (_, i) => `mx${i}.example.org`)
    expect(validateMxHosts(long, 255, 128).mxHosts).toEqual([
      { key: 'validation.tooLong', params: { max: '255' } },
    ])
    const many = Array.from({ length: 129 }, (_, i) => `m${i}.e`)
    expect(validateMxHosts(many, 10_000, 128).mxHosts).toEqual([
      { key: 'validation.tooMany', params: { max: '128' } },
    ])
    expect(validateMxHosts(['*.example.org', 'mail.example.org'], 255, 128)).toEqual({})
  })

  it('writes the hosts back as the classic form shows them', () => {
    expect(formatMxHosts(['a.example', 'b.example'])).toBe('a.example, b.example')
  })
})
