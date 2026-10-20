import { mockPushSettings } from '../../factories/push-settings'
import type { ScenarioDefinition } from '../index'
import { ANNA, seedAnna } from './seed'
import { ensureMailbox, mailboxSelfService } from './state'
export const pushNotificationScenarios: Record<string, ScenarioDefinition> = {
  'pushover-configured': {
    description: 'Pushover has stored application and user credentials.',
    setup: (state) => {
      seedAnna(state)
      mailboxSelfService(state, ANNA).push = mockPushSettings()
    },
    overrides: { signedInAs: ANNA },
  },
  'pushover-unconfigured': {
    description: 'No Pushover settings or credentials are stored.',
    setup: (state) => seedAnna(state),
    overrides: { signedInAs: ANNA },
  },
  'pushover-outage': {
    description: 'Pushover settings are stored, but verification is unavailable.',
    setup: (state) => {
      seedAnna(state)
      mailboxSelfService(state, ANNA).push = mockPushSettings()
    },
    overrides: { signedInAs: ANNA, selfService: { outages: { pushover: true } } },
  },
  'mailbox-list-tls': {
    description: 'Thirty mailboxes for per-version TLS quick actions.',
    setup: (state) => {
      state.mailboxes = []
      for (let i = 1; i <= 30; i++)
        ensureMailbox(state, `box${String(i).padStart(3, '0')}@example.org`, {
          displayName: `TLS ${i}`,
        })
    },
    overrides: { signedInAs: 'admin' },
  },
}
