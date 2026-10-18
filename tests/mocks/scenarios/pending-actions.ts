// Scenarios of US5 (T110): restricted sessions. Every operation except the session, the identity,
// sign-out and (with second-factor setup as the sole action) passkey registration answers
// `403 pending-action-required`; the account's pending actions are read on every request, so
// tests clear them through `PATCH /__mock/scenarios/:id` (`accounts.<user>.pendingActions`).
import type { ScenarioDefinition } from './index'

export const pendingActionScenarios: Record<string, ScenarioDefinition> = {
  'forced-password-change': {
    description: 'bob@example.org is signed in and must change his password (restricted).',
    overrides: { signedInAs: 'bob@example.org' },
  },
  'forced-second-factor': {
    description: 'alice@example.org is signed in and must set up a second factor (restricted).',
    overrides: {
      accounts: {
        'alice@example.org': { secondFactors: [], pendingActions: ['secondFactorSetup'] },
      },
      signedInAs: 'alice@example.org',
    },
  },
  'forced-both': {
    description:
      'alice@example.org must set up a second factor and change her password (restricted).',
    overrides: {
      accounts: {
        'alice@example.org': {
          secondFactors: [],
          pendingActions: ['secondFactorSetup', 'passwordChange'],
        },
      },
      signedInAs: 'alice@example.org',
    },
  },
}
