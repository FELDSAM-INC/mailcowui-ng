// Domain names (UI 002 T022, research D15, FR-020, FR-042).
import { describe, expect, it } from 'vitest'

import { isValidDomainName, matchesTypedName, toAsciiDomain } from '@/features/domains/domain-name'

describe('domain names', () => {
  it('converts the readable form to lower-case ASCII', () => {
    expect(toAsciiDomain(' MÜNCHEN.de ')).toBe('xn--mnchen-3ya.de')
    expect(toAsciiDomain('Example.ORG')).toBe('example.org')
    expect(toAsciiDomain('')).toBeNull()
    expect(toAsciiDomain('a b.example')).toBeNull()
    expect(toAsciiDomain('user@example.org')).toBeNull()
    expect(toAsciiDomain('example.org/path')).toBeNull()
  })

  it('accepts single labels and valid names', () => {
    expect(isValidDomainName('localdomain')).toBe(true)
    expect(isValidDomainName('münchen.de')).toBe(true)
    expect(isValidDomainName('a-b.example')).toBe(true)
  })

  it('refuses invalid names', () => {
    const label63 = 'a'.repeat(63)
    const long = [label63, label63, label63, 'a'.repeat(62)].join('.') // 254
    expect(long.length).toBe(254)
    expect(isValidDomainName(long)).toBe(false)
    expect(isValidDomainName(long.slice(1))).toBe(true)
    expect(isValidDomainName(`${'a'.repeat(64)}.example`)).toBe(false)
    expect(isValidDomainName('-a.example')).toBe(false)
    expect(isValidDomainName('a-.example')).toBe(false)
    expect(isValidDomainName('a_b.example')).toBe(false)
    expect(isValidDomainName('a..example')).toBe(false)
    expect(isValidDomainName('a example')).toBe(false)
    expect(isValidDomainName('')).toBe(false)
  })

  it('matches a typed confirmation by readable or ASCII name, ignoring case', () => {
    const domain = { name: 'xn--mnchen-3ya.de', unicodeName: 'münchen.de' }
    expect(matchesTypedName('münchen.de', domain)).toBe(true)
    expect(matchesTypedName('MÜNCHEN.DE', domain)).toBe(true)
    expect(matchesTypedName(' xn--mnchen-3ya.de ', domain)).toBe(true)
    expect(matchesTypedName('munchen.de', domain)).toBe(false)
    expect(matchesTypedName('', domain)).toBe(false)
  })
})
