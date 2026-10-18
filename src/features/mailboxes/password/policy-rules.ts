// The password policy as legacy lists it under the password (`password_complexity('html')`): the
// rules that are set, in legacy's order (length, letters, special characters, mixed case, digits),
// with the `admin.password_policy_*` texts. `meetsPolicy` applies the API's own definitions
// (length in UTF-8 bytes, letters `[A-Za-z]`, digits, special = anything else, both cases); it is
// the generator's oracle (SC-008).
import type { PasswordPolicy } from '@/api'
import type { LegacyKey } from '@/i18n'

export type PolicyValues = Omit<PasswordPolicy, 'etag'>

export interface PolicyRule {
  key: LegacyKey
  args: number[]
}

export function policyRules(policy: PolicyValues): PolicyRule[] {
  const rules: PolicyRule[] = []
  if (policy.minLength > 0)
    rules.push({ key: 'admin.password_policy_length', args: [policy.minLength] })
  if (policy.requireLetters) rules.push({ key: 'admin.password_policy_chars', args: [] })
  if (policy.requireSpecialCharacters) {
    rules.push({ key: 'admin.password_policy_special_chars', args: [] })
  }
  if (policy.requireMixedCase) rules.push({ key: 'admin.password_policy_lowerupper', args: [] })
  if (policy.requireDigits) rules.push({ key: 'admin.password_policy_numbers', args: [] })
  return rules
}

const encoder = new TextEncoder()

export function meetsPolicy(policy: PolicyValues, password: string): boolean {
  if (encoder.encode(password).length < policy.minLength) return false
  if (policy.requireLetters && !/[A-Za-z]/.test(password)) return false
  if (policy.requireDigits && !/[0-9]/.test(password)) return false
  if (policy.requireSpecialCharacters && !/[^A-Za-z0-9]/.test(password)) return false
  if (policy.requireMixedCase && !(/[a-z]/.test(password) && /[A-Z]/.test(password))) return false
  return true
}
