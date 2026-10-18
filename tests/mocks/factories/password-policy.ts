// Password policy factory (UI 003 T009): the legacy defaults (minimum 6, no class required) and the
// version tag the contract defines: the SHA-256 of
// `length=<n>;chars=<0|1>;special_chars=<0|1>;lowerupper=<0|1>;numbers=<0|1>`, base64url without
// padding, quoted.
import { createHash } from 'node:crypto'

import type { PasswordPolicy } from '@/api'

export type MockPasswordPolicy = Omit<PasswordPolicy, 'etag'>

export const defaultPasswordPolicy = (): MockPasswordPolicy => ({
  minLength: 6,
  requireLetters: false,
  requireDigits: false,
  requireSpecialCharacters: false,
  requireMixedCase: false,
})

export function passwordPolicyEtag(policy: MockPasswordPolicy): string {
  const flag = (value: boolean) => (value ? 1 : 0)
  const source =
    `length=${policy.minLength};chars=${flag(policy.requireLetters)};` +
    `special_chars=${flag(policy.requireSpecialCharacters)};` +
    `lowerupper=${flag(policy.requireMixedCase)};numbers=${flag(policy.requireDigits)}`
  return `"${createHash('sha256').update(source).digest('base64url')}"`
}

export function passwordPolicyView(policy: MockPasswordPolicy): PasswordPolicy {
  return { ...policy, etag: passwordPolicyEtag(policy) }
}

/** The policy check of the API (legacy `password_check`), with its rule codes. */
export function passwordViolations(
  policy: MockPasswordPolicy,
  password: string,
): { code: 'tooShort' | 'missingCharacterClass'; params: Record<string, unknown> }[] {
  const violations: {
    code: 'tooShort' | 'missingCharacterClass'
    params: Record<string, unknown>
  }[] = []
  if (Buffer.byteLength(password, 'utf8') < policy.minLength) {
    violations.push({ code: 'tooShort', params: { min: policy.minLength } })
  }
  if (policy.requireLetters && !/[A-Za-z]/.test(password)) {
    violations.push({ code: 'missingCharacterClass', params: { characterClass: 'letter' } })
  }
  if (policy.requireDigits && !/[0-9]/.test(password)) {
    violations.push({ code: 'missingCharacterClass', params: { characterClass: 'digit' } })
  }
  if (policy.requireSpecialCharacters && !/[^A-Za-z0-9]/.test(password)) {
    violations.push({ code: 'missingCharacterClass', params: { characterClass: 'special' } })
  }
  if (policy.requireMixedCase && !(/[a-z]/.test(password) && /[A-Z]/.test(password))) {
    violations.push({ code: 'missingCharacterClass', params: { characterClass: 'lowerAndUpper' } })
  }
  return violations
}
