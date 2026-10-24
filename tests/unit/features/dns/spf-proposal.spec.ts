import { describe, expect, it } from 'vitest'
import type { DnsCheck } from '@/api'
import { spfProposal } from '@/features/dns/diagnostics/spf-proposal'

function check(record: string | null, patch: Partial<DnsCheck> = {}): DnsCheck {
  return {
    id: 'spf',
    scope: 'domain',
    recordName: 'example.org',
    recordType: 'TXT',
    status: record ? 'mismatch' : 'missing',
    optional: true,
    expected: null,
    found: record ? [record] : [],
    guidance: [
      {
        code: 'spfAuthorizeAddresses',
        params: { ipv4: '192.0.2.25', ipv6: '2001:db8::25' },
        message: '',
      },
    ],
    reason: record
      ? { code: 'spfNotPass', params: { address: '192.0.2.25', result: 'fail' }, message: '' }
      : null,
    notes: [],
    ...patch,
  }
}

describe('SPF proposals from DNS diagnostics', () => {
  it('creates a record using only known server addresses when SPF is missing', () => {
    expect(spfProposal(check(null))).toMatchObject({
      kind: 'create',
      record: 'v=spf1 ip4:192.0.2.25 ip6:2001:db8::25 ~all',
    })
  })
  it('keeps existing providers, exclusions and the final policy', () => {
    const old = 'v=spf1 include:_spf.example.net -ip4:198.51.100.7 a mx -all'
    expect(spfProposal(check(old))).toMatchObject({
      kind: 'update',
      current: old,
      record:
        'v=spf1 ip4:192.0.2.25 ip6:2001:db8::25 include:_spf.example.net -ip4:198.51.100.7 a mx -all',
    })
  })
  it('keeps redirects without adding an all mechanism', () => {
    expect(
      spfProposal(check('v=spf1 redirect=_spf.example.net exp=explain.example.net')).record,
    ).toBe(
      'v=spf1 ip4:192.0.2.25 ip6:2001:db8::25 redirect=_spf.example.net exp=explain.example.net',
    )
  })
  it('does not duplicate addresses already covered by positive IP networks', () => {
    const value = spfProposal(
      check('v=spf1 ip4:192.0.2.0/24 -all', {
        reason: {
          code: 'spfNotPass',
          params: { address: '2001:db8::25', result: 'fail' },
          message: '',
        },
      }),
    )
    expect(value.record).toBe('v=spf1 ip6:2001:db8::25 ip4:192.0.2.0/24 -all')
    expect(
      spfProposal(check('v=spf1 +ip6:2001:0db8:0000:0000:0000:0000:0000:0000/64 -all')).record,
    ).toBe('v=spf1 ip4:192.0.2.25 +ip6:2001:0db8:0000:0000:0000:0000:0000:0000/64 -all')
  })
  it('inserts authorizations before matching exclusions and unreachable mechanisms', () => {
    expect(spfProposal(check('v=spf1 -ip4:192.0.2.25 ip4:192.0.2.0/24 -all')).record).toBe(
      'v=spf1 ip4:192.0.2.25 ip6:2001:db8::25 -ip4:192.0.2.25 ip4:192.0.2.0/24 -all',
    )
    expect(spfProposal(check('v=spf1 -all ip4:192.0.2.25')).record).toBe(
      'v=spf1 ip4:192.0.2.25 ip6:2001:db8::25 -all ip4:192.0.2.25',
    )
  })
  it('recognizes a passing policy, including authorization through include', () => {
    expect(
      spfProposal(check('v=spf1 include:_spf.example.net -all', { status: 'match', reason: null })),
    ).toMatchObject({ kind: 'unchanged', record: null })
  })
  it.each(['spfError', 'spfTooManyLookups', 'spfTooManyVoidLookups'] as const)(
    'does not hide %s behind a proposed record',
    (code) => {
      expect(
        spfProposal(
          check('v=spf1 include:broken.example.net -all', {
            reason: { code, params: {}, message: '' },
          }),
        ),
      ).toMatchObject({ kind: 'review', record: null })
    },
  )
  it('requires review for multiple records and missing DNS information', () => {
    expect(
      spfProposal(check('v=spf1 -all', { found: ['v=spf1 -all', 'v=spf1 mx ~all'] })),
    ).toMatchObject({ kind: 'review', record: null })
    expect(spfProposal(check(null, { status: 'lookupFailed' }))).toMatchObject({
      kind: 'unavailable',
      record: null,
    })
    expect(spfProposal(check(null, { guidance: [] }))).toMatchObject({
      kind: 'unavailable',
      record: null,
    })
  })
  it('rejects malformed address and record data without putting it in a copyable suggestion', () => {
    expect(
      spfProposal(
        check(null, {
          guidance: [
            {
              code: 'spfAuthorizeAddresses',
              params: { ipv4: '192.0.2.25 -all', ipv6: null },
              message: '',
            },
          ],
        }),
      ).record,
    ).toBeNull()
    expect(spfProposal(check('v=spf1 -all\nother.example TXT bad')).record).toBeNull()
  })
})
