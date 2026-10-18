// The password generator (UI 003 T026, research R8, FR-029, SC-008): at least 16 characters or the
// policy minimum, lower and upper case and digits always, a special character from `-_.+=!?` when
// the policy requires one or is unknown, no look-alikes, never a leading `{`, uniform choices.
import { describe, expect, it } from 'vitest'

import type { PasswordPolicy } from '@/api'

import { generatePassword, LOOK_ALIKES, SPECIAL } from '@/features/mailboxes/password/generate'
import { meetsPolicy } from '@/features/mailboxes/password/policy-rules'

type Policy = Omit<PasswordPolicy, 'etag'>

const policy = (overrides: Partial<Policy> = {}): Policy => ({
  minLength: 6,
  requireLetters: false,
  requireDigits: false,
  requireSpecialCharacters: false,
  requireMixedCase: false,
  ...overrides,
})

describe('generatePassword', () => {
  it('is 16 characters long, or the policy minimum when longer, at most 255', () => {
    expect(generatePassword(policy({ minLength: 6 }))).toHaveLength(16)
    expect(generatePassword(policy({ minLength: 32 }))).toHaveLength(32)
    expect(generatePassword(policy({ minLength: 400 }))).toHaveLength(255)
    expect(generatePassword(null)).toHaveLength(16)
  })

  it('always holds lower case, upper case and digits, and no look-alike character', () => {
    for (let run = 0; run < 200; run += 1) {
      const value = generatePassword(policy())
      expect(value).toMatch(/[a-z]/)
      expect(value).toMatch(/[A-Z]/)
      expect(value).toMatch(/[0-9]/)
      for (const char of LOOK_ALIKES) expect(value).not.toContain(char)
      expect(value.startsWith('{')).toBe(false)
    }
  })

  it('adds a special character when required or when the policy is unknown, otherwise none', () => {
    const special = new RegExp(`[${SPECIAL.replace(/[-\\]^]/g, '\\$&')}]`)
    for (let run = 0; run < 100; run += 1) {
      expect(generatePassword(policy({ requireSpecialCharacters: true }))).toMatch(special)
      expect(generatePassword(null)).toMatch(special)
      expect(generatePassword(policy())).not.toMatch(special)
    }
  })

  it('uses rejection sampling, so the alphabet boundary carries no bias', () => {
    // A source that returns the largest 32-bit values first: they must be rejected, not folded.
    const values = [0xffffffff, 0xfffffffe, ...Array.from({ length: 4000 }, (_, i) => i * 7919)]
    let index = 0
    const random = (count: number) => {
      const out = new Uint32Array(count)
      for (let i = 0; i < count; i += 1) out[i] = values[index++ % values.length]!
      return out
    }
    const value = generatePassword(policy(), random)
    expect(value).toHaveLength(16)
    expect(index).toBeGreaterThan(16)
  })

  it('SC-008: 10,000 passwords per policy configuration all meet their policy', () => {
    const flags = [
      'requireLetters',
      'requireDigits',
      'requireSpecialCharacters',
      'requireMixedCase',
    ] as const
    for (let mask = 0; mask < 16; mask += 1) {
      for (const minLength of [0, 6, 16, 17, 32, 64]) {
        const current = policy({
          minLength,
          ...Object.fromEntries(flags.map((flag, bit) => [flag, Boolean(mask & (1 << bit))])),
        })
        for (let run = 0; run < 10_000; run += 1) {
          if (!meetsPolicy(current, generatePassword(current))) {
            throw new Error(`policy ${JSON.stringify(current)} not met`)
          }
        }
      }
    }
  }, 120_000)
})
