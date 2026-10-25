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
  it('creates a record authorizing MX hosts without requiring explicit server addresses', () => {
    expect(spfProposal(check(null, { guidance: [] }))).toMatchObject({
      kind: 'create',
      record: 'v=spf1 mx ~all',
    })
  })
  it('adds mx to the reported dot.sk policy while preserving the include and hard fail', () => {
    const old = 'v=spf1 include:atlantis.sk -all'
    expect(spfProposal(check(old, { recordName: 'dot.sk' }))).toEqual({
      kind: 'update',
      current: old,
      record: 'v=spf1 mx include:atlantis.sk -all',
    })
  })
  it('keeps existing providers, exclusions, address ranges and spacing', () => {
    const old = 'v=spf1  include:_spf.example.net -ip4:198.51.100.7 a ip6:2001:db8::/32 ~all'
    expect(spfProposal(check(old)).record).toBe(
      'v=spf1 mx  include:_spf.example.net -ip4:198.51.100.7 a ip6:2001:db8::/32 ~all',
    )
  })
  it('keeps redirects without adding an all mechanism', () => {
    expect(
      spfProposal(check('v=spf1 redirect=_spf.example.net exp=explain.example.net')).record,
    ).toBe('v=spf1 mx redirect=_spf.example.net exp=explain.example.net')
  })
  it.each(['mx', '+MX', 'mx/24', 'mx//64', 'mx/24//64', 'mx:EXAMPLE.ORG.', 'mx:%{d}'])(
    'does not duplicate existing MX authorization: %s',
    (mechanism) => {
      expect(spfProposal(check(`v=spf1 ${mechanism} include:provider.example -all`))).toMatchObject(
        {
          kind: 'mxPresent',
          record: null,
        },
      )
    },
  )
  it.each(['-mx', '~mx', '?MX', '-mx:example.org'])(
    'preserves intentional MX exclusions: %s',
    (mechanism) => {
      expect(spfProposal(check(`v=spf1 ${mechanism} -all`))).toMatchObject({
        kind: 'review',
        record: null,
      })
    },
  )
  it('does not duplicate an unreachable mx mechanism after all', () => {
    expect(spfProposal(check('v=spf1 -all mx'))).toMatchObject({
      kind: 'mxPresent',
      record: null,
    })
  })
  it('distinguishes MX hosts of another domain from the current domain', () => {
    expect(spfProposal(check('v=spf1 mx:provider.example include:mx.example -all')).record).toBe(
      'v=spf1 mx mx:provider.example include:mx.example -all',
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
  })
  it('does not copy address guidance into a suggested record', () => {
    expect(
      spfProposal(
        check(null, {
          guidance: [
            { code: 'spfAuthorizeAddresses', params: { ipv4: '192.0.2.25 -all' }, message: '' },
          ],
        }),
      ).record,
    ).toBe('v=spf1 mx ~all')
  })
  it.each(['v=spf1 -all\nother.example TXT bad', 'v=spf1 mx\u202E -all', 'other data'])(
    'rejects malformed record data: %s',
    (record) => expect(spfProposal(check(record))).toMatchObject({ kind: 'review', record: null }),
  )
})
