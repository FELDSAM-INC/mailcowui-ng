// Scenarios of US2 (T047): the own second factors. anna@example.org signs in with her TOTP entry
// (21) and has a security key (22) unless a scenario says otherwise.
import type { ScenarioDefinition } from '../index'
import { totp } from '../accounts'
import type { ScenarioState } from '../state'
import { accountSelfService } from './state'
import { ANNA, seedAnna } from './seed'

function anna(state: ScenarioState) {
  return state.accounts.find((account) => account.username === ANNA)!
}

const signedIn = { signedInAs: ANNA, session: { authMethod: 'passwordAndSecondFactor' as const } }

export const twoFactorScenarios: Record<string, ScenarioDefinition> = {
  'account-two-factor-empty': {
    description: 'anna@example.org without second factors (password sign-in).',
    setup: (state) => {
      seedAnna(state)
      anna(state).secondFactors = []
      accountSelfService(state, ANNA).signInFactorId = null
    },
    overrides: { signedInAs: ANNA },
  },
  'account-two-factor-two-active': {
    description: 'anna@example.org with an active TOTP entry and an active security key.',
    setup: (state) => seedAnna(state),
    overrides: signedIn,
  },
  'account-two-factor-single-active': {
    description: 'anna@example.org with one active TOTP entry.',
    setup: (state) => {
      seedAnna(state)
      anna(state).secondFactors = [totp(21, 'Phone')]
    },
    overrides: signedIn,
  },
  'account-two-factor-required-by-policy': {
    description: 'anna@example.org must keep a second factor (force_tfa).',
    setup: (state) => {
      seedAnna(state)
      accountSelfService(state, ANNA).secondFactorRequired = true
    },
    overrides: signedIn,
  },
  'account-two-factor-inactive-and-unsupported': {
    description:
      'anna@example.org with an active TOTP entry, an inactive TOTP entry and a deprecated U2F key.',
    setup: (state) => {
      seedAnna(state)
      anna(state).secondFactors = [totp(21, 'Phone'), totp(23, 'Old phone')]
      const record = accountSelfService(state, ANNA)
      record.inactiveFactorIds = [23]
      record.extraFactors = [{ id: 24, type: 'u2f', name: 'Old U2F key', active: true }]
    },
    overrides: signedIn,
  },
  'account-yubico-outage-enrolment': {
    description: 'anna@example.org without second factors; the Yubico service is unreachable.',
    setup: (state) => {
      seedAnna(state)
      anna(state).secondFactors = []
      accountSelfService(state, ANNA).signInFactorId = null
    },
    overrides: { signedInAs: ANNA, selfService: { yubicoOutage: true } },
  },
  'account-two-factor-domain-admin': {
    description: 'reseller without second factors.',
    overrides: { signedInAs: 'reseller' },
  },
}
