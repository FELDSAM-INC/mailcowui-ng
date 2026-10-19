// MTA-STS changes (T067, FR-049, FR-050): the form of a policy and of a new one, the patch with only
// the changed members, the identifier notice only when the API renewed the identifier, and the
// activation state change.
import { describe, expect, it } from 'vitest'

import type { MtaStsPolicy } from '@/api'
import {
  activationChange,
  formFromPolicy,
  newPolicyForm,
  policyIdChanged,
  policyPatch,
} from '@/features/dns/mta-sts/policy-change'

import { dnsCapabilities } from './fixtures'

function policy(overrides: Partial<MtaStsPolicy> = {}): MtaStsPolicy {
  return {
    domain: 'example.org',
    displayDomain: 'example.org',
    version: 'STSv1',
    mode: 'enforce',
    mxHosts: ['mail.example.org'],
    maxAge: 604_800,
    active: true,
    policyId: '20261018100000',
    policyUrl: 'https://mta-sts.example.org/.well-known/mta-sts.txt',
    policyText: 'version: STSv1\n',
    dnsRecords: [],
    etag: '"p1"',
    ...overrides,
  }
}

describe('MTA-STS form values', () => {
  it('starts a new policy as the classic form does, with the server host name', () => {
    expect(newPolicyForm(dnsCapabilities())).toEqual({
      version: 'STSv1',
      mode: 'enforce',
      maxAge: '',
      mx: 'mail.example.org',
      active: false,
    })
  })

  it('opens a policy with its values', () => {
    expect(formFromPolicy(policy({ mxHosts: ['a.example', 'b.example'] }))).toEqual({
      version: 'STSv1',
      mode: 'enforce',
      maxAge: '604800',
      mx: 'a.example, b.example',
      active: true,
    })
  })
})

describe('policyPatch', () => {
  const values = { mode: 'enforce', maxAge: 604_800, mxHosts: ['mail.example.org'], active: true }

  it('holds only the changed members', () => {
    expect(policyPatch(policy(), values)).toEqual({})
    expect(policyPatch(policy(), { ...values, mode: 'testing' })).toEqual({ mode: 'testing' })
    expect(policyPatch(policy(), { ...values, active: false })).toEqual({ active: false })
    expect(policyPatch(policy(), { ...values, maxAge: 86_400 })).toEqual({ maxAge: 86_400 })
  })

  it('compares MX hosts by their ASCII form, in order', () => {
    expect(policyPatch(policy(), { ...values, mxHosts: ['Mail.Example.org'] })).toEqual({})
    expect(
      policyPatch(policy({ mxHosts: ['a.example', 'b.example'] }), {
        ...values,
        mxHosts: ['b.example', 'a.example'],
      }),
    ).toEqual({ mxHosts: ['b.example', 'a.example'] })
  })
})

describe('identifier and activation changes', () => {
  it('reports a renewed identifier only when the API changed it', () => {
    expect(policyIdChanged(policy(), policy({ policyId: '20261018100500' }))).toBe(true)
    expect(policyIdChanged(policy(), policy({ active: false }))).toBe(false)
    expect(policyIdChanged(null, policy())).toBe(false)
  })

  it('names an activation or a deactivation', () => {
    expect(activationChange(policy({ active: false }), policy())).toBe('activated')
    expect(activationChange(policy(), policy({ active: false }))).toBe('deactivated')
    expect(activationChange(policy(), policy())).toBeNull()
    expect(activationChange(null, policy())).toBe('activated')
    expect(activationChange(null, policy({ active: false }))).toBeNull()
  })
})
