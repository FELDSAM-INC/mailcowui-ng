// Domain names (UI 002 T022, research D15, FR-020, FR-042), promoted to shared at their second use
// by UI 010 (T016, research R3), which adds the `wildcard` and `trailingDot` options of MX hosts.
import { describe, expect, it } from 'vitest'

import { isValidDomainName, matchesTypedName, toAsciiDomain } from '@/shared/validation/domain-name'

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

  it('UI 010: accepts a leading wildcard label only with the wildcard option', () => {
    expect(isValidDomainName('*.example.org')).toBe(false)
    expect(isValidDomainName('*.example.org', { wildcard: true })).toBe(true)
    expect(isValidDomainName('*.münchen.de', { wildcard: true })).toBe(true)
    expect(isValidDomainName('a.*.example.org', { wildcard: true })).toBe(false)
    expect(isValidDomainName('*', { wildcard: true })).toBe(false)
    expect(isValidDomainName('*example.org', { wildcard: true })).toBe(false)
    expect(toAsciiDomain('*.MÜNCHEN.de', { wildcard: true })).toBe('*.xn--mnchen-3ya.de')
  })

  it('UI 010: removes one trailing dot with the trailingDot option', () => {
    expect(isValidDomainName('mail.example.org.')).toBe(false)
    expect(isValidDomainName('mail.example.org.', { trailingDot: true })).toBe(true)
    expect(toAsciiDomain('Mail.Example.org.', { trailingDot: true })).toBe('mail.example.org')
    expect(isValidDomainName('mail.example.org..', { trailingDot: true })).toBe(false)
  })

  it('UI 010: measures 253 characters on the ASCII form, 63 per label', () => {
    const label63 = 'b'.repeat(63)
    const name = [label63, label63, label63, 'b'.repeat(61)].join('.')
    expect(name.length).toBe(253)
    expect(isValidDomainName(name, { wildcard: true })).toBe(true)
    expect(isValidDomainName(`*.${name}`, { wildcard: true })).toBe(false)
  })
})
