import type { ScenarioDefinition } from '../index'
import { ANNA, seedAnna } from './seed'
import { ensureMailbox } from './state'

export const mailAppsScenarios: Record<string, ScenarioDefinition> = {
  'account-mailbox-no-pop3': {
    description: 'Mailbox has direct POP3 access disabled but app passwords allowed.',
    setup: (state) => {
      seedAnna(state)
      ensureMailbox(state, ANNA).protocolAccess.pop3 = false
    },
    overrides: { signedInAs: ANNA },
  },
  'account-mailbox-2fa-on': {
    description: 'Active second factors require app password guidance in the setup guide.',
    setup: (state) => seedAnna(state),
    overrides: { signedInAs: ANNA, session: { authMethod: 'passwordAndSecondFactor' } },
  },
  'account-profile-flag-withdrawn': {
    description:
      'App password permission is withdrawn after loading through the scenario patch API.',
    setup: (state) => seedAnna(state),
    overrides: { signedInAs: ANNA },
  },
}
