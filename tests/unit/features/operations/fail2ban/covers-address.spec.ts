// UI 011 (FR-064, FR-069, T104): whether a denylist entry or a banned network covers the caller's
// own address, so that the app can warn before the administrator locks themselves out.
import { describe, expect, it } from 'vitest'

import { coversAddress } from '@/features/operations/fail2ban/covers-address'

describe('coversAddress', () => {
  it.each([
    ['198.51.100.0/24', '198.51.100.7', true],
    ['198.51.100.7', '198.51.100.7', true],
    ['198.51.100.7/32', '198.51.100.7', true],
    ['198.51.100.8/32', '198.51.100.7', false],
    ['198.51.0.0/16', '198.51.100.7', true],
    ['198.52.0.0/16', '198.51.100.7', false],
    ['0.0.0.0/0', '198.51.100.7', true],
    ['2001:db8::/32', '2001:db8:1::5', true],
    ['2001:db8:1::/48', '2001:db8:2::5', false],
    ['::/0', '2001:db8::1', true],
    ['2001:db8::1', '2001:db8:0:0::1', true],
    ['::ffff:198.51.100.0/120', '::ffff:198.51.100.7', true],
    ['198.51.100.0/24', '2001:db8::1', false],
    ['2001:db8::/32', '198.51.100.7', false],
    ['office.example.org', '198.51.100.7', false],
    ['not an address', '198.51.100.7', false],
    ['198.51.100.0/24', '', false],
  ])('%s covers %s: %s', (entry, address, expected) => {
    expect(coversAddress(entry, address)).toBe(expected)
  })
})
