// T073: the rules of the second-factor step (FR-020, FR-022, FR-023, data-model §7).
import { describe, expect, it } from 'vitest'

import { ApiProblem, type SecondFactorMethod } from '@/api'
import {
  groupMethods,
  isTotpCode,
  isYubiOtp,
  normaliseCode,
  stepOutcome,
} from '@/features/auth/composables/useSecondFactor'
import { WebAuthnCeremonyError } from '@/shared/platform/webauthn'

const method = (
  id: number,
  type: SecondFactorMethod['type'],
  name = `m${id}`,
): SecondFactorMethod => ({
  id,
  type,
  name,
  tier: type === 'yubiOtp' ? 'advanced' : 'primary',
})

const problem = (status: number, name: string | null) =>
  ApiProblem.fromParts({
    kind: 'problem',
    status,
    type: name ? `/api/v2/problems/${name}` : 'about:blank',
  })

describe('groupMethods (FR-020)', () => {
  it('keeps the server order and puts advanced methods behind "Other methods"', () => {
    const groups = groupMethods([method(1, 'webauthn'), method(2, 'totp'), method(3, 'yubiOtp')])
    expect(groups.primary.map((m) => m.id)).toEqual([1, 2])
    expect(groups.advanced.map((m) => m.id)).toEqual([3])
    expect(groups.advancedDirect).toBe(false)
  })

  it('shows advanced methods directly when there is no primary method', () => {
    const groups = groupMethods([method(3, 'yubiOtp')])
    expect(groups.primary).toEqual([])
    expect(groups.advancedDirect).toBe(true)
  })

  it('groups several TOTP methods into one section', () => {
    const groups = groupMethods([method(1, 'totp', 'Phone'), method(2, 'totp', 'Tablet')])
    expect(groups.sections.map((s) => s.type)).toEqual(['totp'])
    expect(groups.sections[0]?.methods.map((m) => m.name)).toEqual(['Phone', 'Tablet'])
  })
})

describe('code checks (FR-022, FR-023)', () => {
  it('accepts exactly six digits after removing whitespace', () => {
    expect(normaliseCode(' 123 456 ')).toBe('123456')
    expect(isTotpCode('123456')).toBe(true)
    expect(isTotpCode('12345')).toBe(false)
    expect(isTotpCode('1234567')).toBe(false)
    expect(isTotpCode('12345a')).toBe(false)
  })

  it('accepts 44 letters or digits for Yubico OTP', () => {
    expect(isYubiOtp('c'.repeat(44))).toBe(true)
    expect(isYubiOtp('c'.repeat(43))).toBe(false)
    expect(isYubiOtp(`${'c'.repeat(43)}-`)).toBe(false)
  })
})

describe('stepOutcome (data-model §7)', () => {
  it('returns to the password step after a rejected factor or an expired step', () => {
    expect(stepOutcome(problem(401, 'second-factor-failed'))).toEqual({
      kind: 'restart',
      notice: 'secondFactorRejected',
    })
    expect(stepOutcome(problem(401, 'sign-in-expired'))).toEqual({
      kind: 'restart',
      notice: 'signInTimedOut',
    })
    expect(stepOutcome(problem(403, 'second-factor-unavailable'))).toEqual({
      kind: 'restart',
      notice: 'secondFactorUnavailable',
    })
  })

  it('stays in the step during a temporary verification failure', () => {
    const failure = problem(503, 'temporary-verification-failure')
    expect(stepOutcome(failure)).toEqual({ kind: 'stay', problem: failure })
  })

  it('stays silently after a cancelled or aborted prompt', () => {
    expect(stepOutcome(new WebAuthnCeremonyError('cancelled', null))).toEqual({ kind: 'silent' })
    expect(stepOutcome(new WebAuthnCeremonyError('aborted', null))).toEqual({ kind: 'silent' })
  })

  it('stays with a message for other WebAuthn failures and transport errors', () => {
    expect(stepOutcome(new WebAuthnCeremonyError('insecure', null))).toEqual({
      kind: 'stay',
      messageKey: 'passkeys.errors.insecure',
    })
    const network = ApiProblem.fromParts({ kind: 'network' })
    expect(stepOutcome(network)).toEqual({ kind: 'stay', problem: network })
    const unknown = stepOutcome(new Error('boom'))
    expect(unknown.kind).toBe('stay')
  })
})
