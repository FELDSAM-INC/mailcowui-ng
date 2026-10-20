import type { ScenarioDefinition } from './index'
import { findAccount, type ScenarioState } from './state'
import { mockDomain } from '../factories/domain'
import { mockMailbox } from '../factories/mailbox'

function ready(state: ScenarioState) {
  state.domains = [mockDomain({ name: 'example.org' }), mockDomain({ name: 'example.net' })]
  state.mailboxes = [mockMailbox({ localPart: 'alice', domain: 'example.org' })]
  findAccount(state, 'alice@example.org')!.pendingActions = []
  findAccount(state, 'reseller')!.permissions.loginAs = true
}
export const actingScenarios: Record<string, ScenarioDefinition> = {
  'acting-admin': {
    description: 'Administrator may act as mailboxes and domain administrators',
    overrides: { signedInAs: 'admin' },
    setup: ready,
  },
  'acting-reseller-login-as': {
    description: 'Domain administrator can act inside their domain scope',
    overrides: { signedInAs: 'reseller' },
    setup: ready,
  },
  'acting-reseller-no-login-as': {
    description: 'No acting action without loginAs',
    overrides: { signedInAs: 'reseller' },
    setup: (state) => {
      ready(state)
      findAccount(state, 'reseller')!.permissions.loginAs = false
    },
  },
  'acting-target-forced': {
    description: 'Target restrictions do not restrict the acting session',
    overrides: { signedInAs: 'admin' },
    setup: (state) => {
      ready(state)
      findAccount(state, 'alice@example.org')!.pendingActions = [
        'passwordChange',
        'secondFactorSetup',
      ]
    },
  },
  'acting-target-inactive': {
    description: 'Inactive targets may still be acted as',
    overrides: { signedInAs: 'admin' },
    setup: (state) => {
      ready(state)
      findAccount(state, 'alice@example.org')!.active = false
      state.mailboxes[0]!.active = false
    },
  },
}
