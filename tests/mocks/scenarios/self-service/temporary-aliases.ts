import { HOUR, mockTemporaryAlias } from '../../factories/temporary-alias'
import type { ScenarioDefinition } from '../index'
import { ANNA, seedAnna } from './seed'
import { mailboxSelfService } from './state'
export const temporaryAliasScenarios: Record<string, ScenarioDefinition> = {
  'temporary-aliases-empty': {
    description: 'No temporary aliases; the mailbox and one alias domain are available.',
    setup: (state) => seedAnna(state),
    overrides: { signedInAs: ANNA },
  },
  'temporary-aliases-many': {
    description: 'Thirty expiring and permanent aliases; alias01 refuses changes.',
    setup: (state) => {
      seedAnna(state)
      mailboxSelfService(state, ANNA).temporaryAliases = Array.from({ length: 30 }, (_, i) =>
        mockTemporaryAlias({
          address: `alias${String(i + 1).padStart(2, '0')}@example.org`,
          description: `Shop ${i + 1}`,
          expiresAt: i % 3 === 0 ? null : state.now() + (i + 1) * 24 * HOUR,
          ...(i === 0 ? { failWith: 412 } : {}),
        }),
      )
    },
    overrides: { signedInAs: ANNA },
  },
  'temporary-aliases-single-domain': {
    description: 'Only the mailbox domain is available.',
    setup: (state) => {
      seedAnna(state)
      mailboxSelfService(state, ANNA).temporaryAliasDomains = []
    },
    overrides: { signedInAs: ANNA },
  },
  'temporary-alias-expired-meanwhile': {
    description: 'An expiring alias can be removed or expired through the runtime patch.',
    setup: (state) => {
      seedAnna(state)
      mailboxSelfService(state, ANNA).temporaryAliases = [
        mockTemporaryAlias({
          address: 'bavoki.rumesa@example.org',
          expiresAt: state.now() + HOUR,
        }),
      ]
    },
    overrides: { signedInAs: ANNA },
  },
}
