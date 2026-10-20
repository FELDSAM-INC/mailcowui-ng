import type { ScenarioDefinition } from '../index'
import { ANNA, seedAnna } from './seed'
import { mailboxSelfService } from './state'
export const appPasswordScenarios: Record<string, ScenarioDefinition> = {
  'account-app-passwords-empty': {
    description: 'App passwords start empty.',
    setup: (state) => {
      seedAnna(state)
      mailboxSelfService(state, ANNA).appPasswords = []
    },
    overrides: { signedInAs: ANNA },
  },
  'account-mailbox-no-app-passwords-flag': {
    description: 'The mailbox user cannot manage app passwords.',
    setup: (state) => seedAnna(state, { flags: { appPasswds: false } }),
    overrides: { signedInAs: ANNA },
  },
  'account-app-passwords-many': {
    description: 'Thirty app passwords for sorting and paging.',
    setup: (state) => {
      seedAnna(state)
      const record = mailboxSelfService(state, ANNA)
      const base = record.appPasswords[0]!
      record.appPasswords = Array.from({ length: 30 }, (_, index) => ({
        ...base,
        id: index + 1,
        name: `Device ${String(index + 1).padStart(2, '0')}`,
        active: index % 2 === 0,
      }))
    },
    overrides: { signedInAs: ANNA },
  },
}
