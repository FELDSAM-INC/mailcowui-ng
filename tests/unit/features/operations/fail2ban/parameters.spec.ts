// UI 011 (FR-068, plan decision 1, T104): the parameters are whole numbers of seconds under the
// legacy labels; the client checks the contract's ranges and that the maximum ban time is not below
// the ban time; a stored value outside the rules does not block a save that leaves it unchanged;
// only changed values are sent.
import { describe, expect, it } from 'vitest'

import type { Fail2BanSettings } from '@/api'
import {
  parametersPatch,
  toParametersForm,
  validateParameters,
} from '@/features/operations/fail2ban/parameters'

const STORED: Fail2BanSettings = {
  banTime: 1800,
  maxBanTime: 10000,
  banTimeIncrement: true,
  maxAttempts: 10,
  retryWindow: 600,
  ipv4PrefixLength: 32,
  ipv6PrefixLength: 128,
  externallyEnforced: false,
  allowlist: ['192.0.2.0/24'],
  denylist: ['198.51.100.200'],
  banListId: 'x',
  banListUrl: 'https://mail.example.org/f2b-banlist?id=x',
  stored: true,
  banServiceRunning: true,
  etag: '"f2b1"',
}

describe('parameters form', () => {
  it('opens with the stored values, lists one entry per line', () => {
    const form = toParametersForm(STORED)
    expect(form.banTime).toBe('1800')
    expect(form.allowlist).toBe('192.0.2.0/24')
  })

  it('sends only what changed, numbers as numbers and lists as entries', () => {
    const form = {
      ...toParametersForm(STORED),
      banTime: '7200',
      denylist: '198.51.100.200\n203.0.113.9\n',
    }
    expect(parametersPatch(STORED, form)).toEqual({
      banTime: 7200,
      denylist: ['198.51.100.200', '203.0.113.9'],
    })
    expect(parametersPatch(STORED, toParametersForm(STORED))).toEqual({})
  })

  it('checks the ranges, whole numbers and the maximum against the ban time', () => {
    const form = {
      ...toParametersForm(STORED),
      banTime: '30',
      maxAttempts: '0',
      ipv4PrefixLength: '33',
      retryWindow: '1.5',
    }
    expect(validateParameters(STORED, form)).toEqual({
      banTime: [{ code: 'outOfRange', min: 60, max: 2147483647 }],
      maxAttempts: [{ code: 'outOfRange', min: 1, max: 2147483647 }],
      retryWindow: [{ code: 'invalid' }],
      ipv4PrefixLength: [{ code: 'outOfRange', min: 8, max: 32 }],
    })
    const maximum = { ...toParametersForm(STORED), banTime: '3600', maxBanTime: '1200' }
    expect(validateParameters(STORED, maximum)).toEqual({
      maxBanTime: [{ code: 'outOfRangeMinField', min: 3600, max: 2147483647 }],
    })
    expect(validateParameters(STORED, { ...toParametersForm(STORED), banTime: '' })).toEqual({
      banTime: [{ code: 'required' }],
    })
  })

  it('accepts a stored value outside the rules while it is unchanged', () => {
    const legacy = { ...STORED, banTime: 30 }
    expect(validateParameters(legacy, toParametersForm(legacy))).toEqual({})
    expect(parametersPatch(legacy, { ...toParametersForm(legacy), maxAttempts: '5' })).toEqual({
      maxAttempts: 5,
    })
  })
})
