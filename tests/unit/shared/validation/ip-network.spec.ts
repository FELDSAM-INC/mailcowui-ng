// Allowed networks of API keys and the audit log's address filter (data-model §6).
import { describe, expect, it } from 'vitest'

import { isIpNetwork } from '@/shared/validation/ip-network'

describe('isIpNetwork: IPv4', () => {
  it.each([
    '192.0.2.10',
    '0.0.0.0',
    '255.255.255.255',
    '10.0.0.0/8',
    '192.0.2.0/24',
    '192.0.2.10/32',
    '0.0.0.0/0',
  ])('accepts %s', (value) => {
    expect(isIpNetwork(value)).toBe(true)
  })

  it.each([
    ['an octet above 255', '256.0.0.1'],
    ['an octet above 255 at the end', '192.0.2.999'],
    ['too few octets', '192.0.2'],
    ['too many octets', '192.0.2.1.5'],
    ['an empty octet', '192..2.1'],
    ['a leading zero (ambiguous octal)', '192.0.02.1'],
    ['a prefix above 32', '192.0.2.0/33'],
    ['a negative prefix', '192.0.2.0/-1'],
    ['an empty prefix', '192.0.2.0/'],
    ['a prefix with a leading zero', '192.0.2.0/08'],
    ['two prefixes', '192.0.2.0/24/8'],
    ['letters', '192.0.2.a'],
    ['a trailing dot', '192.0.2.1.'],
    ['spaces', ' 192.0.2.1'],
    ['an inner space', '192.0.2.1 /24'],
    ['a port', '192.0.2.1:80'],
  ])('rejects %s', (_label, value) => {
    expect(isIpNetwork(value)).toBe(false)
  })
})

describe('isIpNetwork: IPv6', () => {
  it.each([
    '2001:0db8:0000:0000:0000:ff00:0042:8329',
    '2001:db8::ff00:42:8329',
    '2001:db8::',
    '::1',
    '::',
    'fe80::1',
    'FE80::ABCD',
    '2001:db8::/32',
    '2001:db8:1:2:3:4:5:6/128',
    '::/0',
    '::ffff:192.0.2.128',
    '64:ff9b::192.0.2.33/120',
    '1:2:3:4:5:6:7::',
    '::2:3:4:5:6:7:8',
  ])('accepts %s', (value) => {
    expect(isIpNetwork(value)).toBe(true)
  })

  it.each([
    ['two double colons', '2001::db8::1'],
    ['too many groups', '1:2:3:4:5:6:7:8:9'],
    ['too few groups without ::', '1:2:3:4:5:6:7'],
    ['a group longer than 4 digits', '2001:db8::12345'],
    ['a non-hex digit', '2001:db8::g1'],
    ['a prefix above 128', '2001:db8::/129'],
    ['an empty prefix', '2001:db8::/'],
    ['a single leading colon', ':1:2:3:4:5:6:7'],
    ['a single trailing colon', '1:2:3:4:5:6:7:'],
    ['a triple colon', '1:::2'],
    ['an embedded IPv4 not at the end', '::192.0.2.1:1'],
    ['an invalid embedded IPv4', '::ffff:192.0.2.256'],
    ['a :: with eight groups', '1:2:3:4::5:6:7:8'],
    ['a zone index', 'fe80::1%eth0'],
    ['brackets', '[2001:db8::1]'],
  ])('rejects %s', (_label, value) => {
    expect(isIpNetwork(value)).toBe(false)
  })
})

describe('isIpNetwork: general', () => {
  it('rejects values longer than 49 characters', () => {
    // 45 characters of a valid address plus a /128 prefix is 49; one more is too long.
    const valid = '0000:0000:0000:0000:0000:ffff:192.168.100.200/128'
    expect(valid.length).toBe(49)
    expect(isIpNetwork(valid)).toBe(true)
    expect(isIpNetwork(`0${valid}`)).toBe(false)
  })

  it.each(['', ' ', 'localhost', 'example.org', '*', 'any'])('rejects %j', (value) => {
    expect(isIpNetwork(value)).toBe(false)
  })
})
