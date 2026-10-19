// Scenarios of US1 (T038): the own password and the forced change. UI 001's
// `forced-password-change` (bob) and `forced-both` (alice) are used as they are; the policy of a
// forced change comes from the scenario's password policy.
import type { ScenarioDefinition } from '../index'
import { domainAdminAccount } from '../accounts'
import { accountSelfService } from './state'
import { ANNA, seedAnna } from './seed'

export const ownPasswordScenarios: Record<string, ScenarioDefinition> = {
  'account-password-throttled': {
    description: 'anna@example.org signed in after ten wrong current passwords (429 on the next).',
    setup: (state) => {
      seedAnna(state)
      accountSelfService(state, ANNA).passwordFailures = 10
    },
    overrides: { signedInAs: ANNA, behaviour: { retryAfter: 90 } },
  },
  'account-forced-password-change-domain-admin': {
    description:
      'A domain administrator must change the password (restricted), policy 10 and digits.',
    setup: (state) => {
      state.accounts.push(
        domainAdminAccount({ username: 'reseller2', pendingActions: ['passwordChange'] }),
      )
    },
    overrides: {
      signedInAs: 'reseller2',
      passwordPolicy: { minLength: 10, requireDigits: true },
    },
  },
  'account-forced-password-policy': {
    description: 'bob@example.org must change his password; policy 10 characters with digits.',
    overrides: {
      signedInAs: 'bob@example.org',
      passwordPolicy: { minLength: 10, requireDigits: true },
    },
  },
  'account-forced-both-policy': {
    description:
      'alice@example.org must change her password and set up a second factor; policy 10 and digits.',
    overrides: {
      accounts: {
        'alice@example.org': {
          secondFactors: [],
          pendingActions: ['secondFactorSetup', 'passwordChange'],
        },
      },
      signedInAs: 'alice@example.org',
      passwordPolicy: { minLength: 10, requireDigits: true },
    },
  },
}
