// Second-factor entries of an account as the self-service operations list them (UI 005 T011,
// data-model §1): the sign-in factors of UI 001's mock (active unless an administrator disabled
// them) and the extra entries only listed here (deprecated `u2f` and `hotp`, inactive entries).
import type { OwnSecondFactor, OwnSecondFactorType } from '@/api'

import type { MockAccount, ScenarioState } from '../scenarios/state'
import { accountSelfService } from '../scenarios/self-service/state'

const USABLE: readonly OwnSecondFactorType[] = ['totp', 'webauthn', 'yubiOtp']

/** Every entry of the account, ordered by ID. */
export function ownSecondFactors(state: ScenarioState, account: MockAccount): OwnSecondFactor[] {
  const extra = accountSelfService(state, account.username)
  const signInFactor =
    state.session.username?.toLowerCase() === account.username.toLowerCase()
      ? extra.signInFactorId
      : null
  const entries: OwnSecondFactor[] = account.secondFactors.map((factor) => ({
    id: factor.id,
    type: factor.type,
    name: factor.name,
    active: !extra.inactiveFactorIds.includes(factor.id),
    usable: true,
    yubicoPublicId: factor.type === 'yubiOtp' ? (extra.yubicoPublicIds[factor.id] ?? null) : null,
    usedForCurrentSignIn: signInFactor === factor.id,
  }))
  for (const item of extra.extraFactors) {
    entries.push({
      id: item.id,
      type: item.type,
      name: item.name,
      active: item.active,
      usable: USABLE.includes(item.type),
      yubicoPublicId: null,
      usedForCurrentSignIn: false,
    })
  }
  return entries.sort((a, b) => a.id - b.id)
}

/** Whether the account has an active, usable entry (two-factor authentication is on). */
export function hasActiveSecondFactor(state: ScenarioState, account: MockAccount): boolean {
  return ownSecondFactors(state, account).some((entry) => entry.active && entry.usable)
}
