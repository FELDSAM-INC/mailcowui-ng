import type { ScenarioDefinition } from '../index'
import { recentLogin } from '../../factories/recent-login'
import { ANNA, seedAnna } from './seed'
import { mailboxSelfService } from './state'

export const recentLoginScenarios: Record<string, ScenarioDefinition> = {
  'account-recent-logins': {
    description:
      'Recent connections with public, internal, unknown-country, deleted-app and older entries.',
    setup: (state) => {
      seedAnna(state)
      mailboxSelfService(state, ANNA).recentLogins.push(
        recentLogin({
          service: 'DAV',
          country: null,
          clientAddress: '8.8.4.4',
          lastSeenAt: new Date(state.now() - 20 * 86_400_000).toISOString(),
        }),
        recentLogin({
          service: 'CUSTOM',
          country: null,
          clientAddress: '9.9.9.9',
          appPassword: { id: 99, name: null },
          lastSeenAt: new Date(state.now() - 3 * 86_400_000).toISOString(),
        }),
      )
    },
    overrides: { signedInAs: ANNA },
  },
  'account-recent-logins-empty': {
    description: 'No recent successful connections.',
    setup: (state) => {
      seedAnna(state)
      mailboxSelfService(state, ANNA).recentLogins = []
    },
    overrides: { signedInAs: ANNA },
  },
}
