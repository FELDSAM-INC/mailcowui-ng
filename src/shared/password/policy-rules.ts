// The password policy as legacy lists it under the password (`password_complexity('html')`): the
// rules that are set, in legacy's order (length, letters, special characters, mixed case, digits),
// with the `admin.password_policy_*` texts. `meetsPolicy` applies the API's own definitions
// (length in UTF-8 bytes, letters `[A-Za-z]`, digits, special = anything else, both cases); it is
// the generator's oracle (SC-008). Created by UI 003; moved here by UI 005 (research R7), which adds
// each rule's met state for the live checklist and the rules a server refusal concerns.
import type { FieldViolation, PasswordPolicy } from '@/api'
import type { LegacyKey } from '@/i18n'

import { utf8ByteLength } from '../validation/utf8'

export type PolicyValues = Omit<PasswordPolicy, 'etag'>

export type PolicyRuleId = 'minLength' | 'letters' | 'special' | 'mixedCase' | 'digits'

export interface PolicyRule {
  key: LegacyKey
  args: number[]
}

export interface PolicyRuleState extends PolicyRule {
  id: PolicyRuleId
  met: boolean
}

const CHECKS: Record<PolicyRuleId, (password: string, policy: PolicyValues) => boolean> = {
  minLength: (password, policy) => utf8ByteLength(password) >= policy.minLength,
  letters: (password) => /[A-Za-z]/.test(password),
  special: (password) => /[^A-Za-z0-9]/.test(password),
  mixedCase: (password) => /[a-z]/.test(password) && /[A-Z]/.test(password),
  digits: (password) => /[0-9]/.test(password),
}

function setRules(policy: PolicyValues): (PolicyRule & { id: PolicyRuleId })[] {
  const rules: (PolicyRule & { id: PolicyRuleId })[] = []
  if (policy.minLength > 0) {
    rules.push({ id: 'minLength', key: 'admin.password_policy_length', args: [policy.minLength] })
  }
  if (policy.requireLetters) {
    rules.push({ id: 'letters', key: 'admin.password_policy_chars', args: [] })
  }
  if (policy.requireSpecialCharacters) {
    rules.push({ id: 'special', key: 'admin.password_policy_special_chars', args: [] })
  }
  if (policy.requireMixedCase) {
    rules.push({ id: 'mixedCase', key: 'admin.password_policy_lowerupper', args: [] })
  }
  if (policy.requireDigits) {
    rules.push({ id: 'digits', key: 'admin.password_policy_numbers', args: [] })
  }
  return rules
}

export function policyRules(policy: PolicyValues): PolicyRule[] {
  return setRules(policy).map(({ key, args }) => ({ key, args }))
}

/** UI 005: the set rules with whether `password` meets each, in legacy's order. */
export function evaluatePolicy(policy: PolicyValues, password: string): PolicyRuleState[] {
  return setRules(policy).map((rule) => ({ ...rule, met: CHECKS[rule.id](password, policy) }))
}

export function meetsPolicy(policy: PolicyValues, password: string): boolean {
  return evaluatePolicy(policy, password).every((rule) => rule.met)
}

const CLASSES: Record<string, PolicyRuleId> = {
  letter: 'letters',
  digit: 'digits',
  special: 'special',
  lowerAndUpper: 'mixedCase',
}

/** UI 005: the rules a server violation of the new password concerns (`tooShort`, classes). */
export function rulesOfViolation(
  violation: Pick<FieldViolation, 'code' | 'params'>,
): PolicyRuleId[] {
  if (violation.code === 'tooShort') return ['minLength']
  if (violation.code === 'missingCharacterClass') {
    const rule = CLASSES[String(violation.params?.characterClass)]
    return rule ? [rule] : []
  }
  return []
}
