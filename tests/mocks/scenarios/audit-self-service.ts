import { selfServiceAuditEvents } from '../factories/audit-event'
import { mockSieveFilter } from '../factories/sieve-filter'
import { mockTemporaryAlias } from '../factories/temporary-alias'
import type { ScenarioDefinition } from './index'
import { ANNA, seedAnna } from './self-service/seed'
import { mailboxSelfService } from './self-service/state'

export const auditSelfServiceScenarios: Record<string, ScenarioDefinition> = {
  'audit-self-service': {
    description: 'Administrator sees every self-service event for Anna, with secrets redacted.',
    setup: (state) => {
      seedAnna(state)
      state.auditEvents = selfServiceAuditEvents(ANNA, state.now())
      state.selfService.sieveFilters = [mockSieveFilter({ id: 1, mailbox: ANNA })]
      mailboxSelfService(state, ANNA).temporaryAliases = [
        mockTemporaryAlias({ address: 'bavoki.rumesa@example.org', description: 'Shop' }),
      ]
    },
    overrides: { signedInAs: 'admin' },
  },
}
