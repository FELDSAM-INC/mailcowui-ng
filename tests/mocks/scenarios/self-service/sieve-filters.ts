import type { ScenarioDefinition } from '../index'
import { mockSieveFilter } from '../../factories/sieve-filter'
import { ANNA, seedAnna } from './seed'
import { ensureMailbox, mailboxSelfService } from './state'

function seedFilters(state: Parameters<typeof seedAnna>[0]) {
  seedAnna(state)
  ensureMailbox(state, 'bob@example.org')
  state.selfService.sieveFilters = Array.from({ length: 40 }, (_, index) =>
    mockSieveFilter({
      id: index + 1,
      mailbox: index < 20 ? ANNA : 'bob@example.org',
      description: index === 0 ? 'Spam to folder' : `Rule ${String(index + 1).padStart(2, '0')}`,
      kind: index % 2 === 0 ? 'prefilter' : 'postfilter',
      active: index < 2 || index === 20 || index === 21,
    }),
  )
  mailboxSelfService(state, ANNA).activeScript = {
    name: 'Personal rules',
    script: 'require ["fileinto"];\nif header :contains "subject" "news" {\n  fileinto "News";\n}',
  }
}
export const sieveFilterScenarios: Record<string, ScenarioDefinition> = {
  'filters-many': {
    description: 'Administrator with 40 Sieve filters across two mailboxes.',
    setup: seedFilters,
    overrides: { signedInAs: 'admin' },
  },
  'filters-domain-admin': {
    description: 'Domain administrator may manage the filters of their mailboxes.',
    setup: seedFilters,
    overrides: { signedInAs: 'reseller' },
  },
  'filters-domain-admin-no-flag': {
    description: 'Domain administrator can read filters but cannot change them.',
    setup: (state) => {
      seedFilters(state)
      state.accounts.find((account) => account.username === 'reseller')!.permissions.filters = false
    },
    overrides: { signedInAs: 'reseller' },
  },
  'account-active-script': {
    description: 'Mailbox user reads only the personal active script.',
    setup: seedFilters,
    overrides: { signedInAs: ANNA },
  },
  'account-no-active-script': {
    description: 'Mailbox has no active personal script.',
    setup: (state) => seedAnna(state),
    overrides: { signedInAs: ANNA },
  },
  'account-active-script-unavailable': {
    description: 'Mail store is unavailable when reading the personal script.',
    setup: seedFilters,
    overrides: { signedInAs: ANNA, selfService: { outages: { mailStore: true } } },
  },
}
