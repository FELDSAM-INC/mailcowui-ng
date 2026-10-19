// The password policy as legacy lists it (UI 003 T026, `password_complexity('html')`): the rules
// that are set, in legacy's order (length, letters, special characters, mixed case, digits), each
// with its `admin.password_policy_*` text; and the policy's own definitions for the generator.
import { describe, expect, it } from 'vitest'

import {
  evaluatePolicy,
  meetsPolicy,
  policyRules,
  rulesOfViolation,
} from '@/shared/password/policy-rules'

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

describe('UI 005: rule states and server errors (T015, research R7)', () => {
  it('names each rule and marks it met or not met, length in UTF-8 bytes', () => {
    expect(
      evaluatePolicy({ ...all, minLength: 10, requireSpecialCharacters: false }, 'summer'),
    ).toEqual([
      { id: 'minLength', key: 'admin.password_policy_length', args: [10], met: false },
      { id: 'letters', key: 'admin.password_policy_chars', args: [], met: true },
      { id: 'mixedCase', key: 'admin.password_policy_lowerupper', args: [], met: false },
      { id: 'digits', key: 'admin.password_policy_numbers', args: [], met: false },
    ])
    const short = { ...all, minLength: 4, requireSpecialCharacters: false, requireMixedCase: false }
    expect(evaluatePolicy(short, 'ä1b').find((rule) => rule.id === 'minLength')?.met).toBe(true)
    expect(evaluatePolicy(short, 'a1b').find((rule) => rule.id === 'minLength')?.met).toBe(false)
  })

  it('treats any other character as special', () => {
    const special = {
      ...all,
      minLength: 0,
      requireLetters: false,
      requireDigits: false,
      requireMixedCase: false,
    }
    expect(evaluatePolicy(special, 'abc')[0]?.met).toBe(false)
    expect(evaluatePolicy(special, 'ab€')[0]?.met).toBe(true)
  })

  it('maps tooShort and missingCharacterClass to the rules they concern', () => {
    expect(rulesOfViolation({ code: 'tooShort', params: { min: 10 } })).toEqual(['minLength'])
    expect(
      rulesOfViolation({ code: 'missingCharacterClass', params: { characterClass: 'letter' } }),
    ).toEqual(['letters'])
    expect(
      rulesOfViolation({ code: 'missingCharacterClass', params: { characterClass: 'digit' } }),
    ).toEqual(['digits'])
    expect(
      rulesOfViolation({ code: 'missingCharacterClass', params: { characterClass: 'special' } }),
    ).toEqual(['special'])
    expect(
      rulesOfViolation({
        code: 'missingCharacterClass',
        params: { characterClass: 'lowerAndUpper' },
      }),
    ).toEqual(['mixedCase'])
    expect(rulesOfViolation({ code: 'preHashedPassword', params: { scheme: 'SSHA' } })).toEqual([])
  })
})
