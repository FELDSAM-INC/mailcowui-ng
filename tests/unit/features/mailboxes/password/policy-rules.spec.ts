// The password policy as legacy lists it (UI 003 T026, `password_complexity('html')`): the rules
// that are set, in legacy's order (length, letters, special characters, mixed case, digits), each
// with its `admin.password_policy_*` text; and the policy's own definitions for the generator.
import { describe, expect, it } from 'vitest'

import { meetsPolicy, policyRules } from '@/features/mailboxes/password/policy-rules'

const all = {
  minLength: 10,
  requireLetters: true,
  requireDigits: true,
  requireSpecialCharacters: true,
  requireMixedCase: true,
}

describe('policyRules', () => {
  it('lists the set rules in legacy order with their keys and parameters', () => {
    expect(policyRules(all)).toEqual([
      { key: 'admin.password_policy_length', args: [10] },
      { key: 'admin.password_policy_chars', args: [] },
      { key: 'admin.password_policy_special_chars', args: [] },
      { key: 'admin.password_policy_lowerupper', args: [] },
      { key: 'admin.password_policy_numbers', args: [] },
    ])
  })

  it('leaves out the rules that are not set, as legacy does for zero values', () => {
    expect(
      policyRules({ ...all, minLength: 0, requireLetters: false, requireSpecialCharacters: false }),
    ).toEqual([
      { key: 'admin.password_policy_lowerupper', args: [] },
      { key: 'admin.password_policy_numbers', args: [] },
    ])
  })
})

describe('meetsPolicy (the API’s definitions)', () => {
  it('counts the length in UTF-8 bytes and checks each class', () => {
    expect(meetsPolicy({ ...all, minLength: 4, requireSpecialCharacters: false }, 'Ab1č')).toBe(
      true,
    )
    expect(meetsPolicy(all, 'Abcdefgh1-')).toBe(true)
    expect(meetsPolicy(all, 'abcdefgh1-')).toBe(false)
    expect(meetsPolicy(all, 'Abcdefghi-')).toBe(false)
    expect(meetsPolicy(all, 'Abcdefgh12')).toBe(false)
    expect(meetsPolicy(all, 'Ab1-')).toBe(false)
  })
})
