// Scenarios of the mailbox bulk actions (UI 003 US6, T095): 50 mailboxes on one page with one whose
// mail store fails; 100 mailboxes for SC-007; a domain administrator without protocol access; and a
// bulk limit of 20. Deleted or changed elsewhere are the control changes of T011.
import { GIB, mockDomain } from '../../factories/domain'
import { mockMailbox, seedMailboxes } from '../../factories/mailbox'
import { permissionFlags } from '../accounts'
import { assignDomains } from '../domains-base'
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'

function setupBulk(state: ScenarioState, count: number): void {
  state.domains.push(
    mockDomain({ name: 'bulk.example', maxMailboxes: 200, domainQuota: 500 * GIB }),
  )
  seedMailboxes(
    state,
    Array.from({ length: count }, (_, index) =>
      mockMailbox({
        localPart: `box${String(index + 1).padStart(3, '0')}`,
        domain: 'bulk.example',
        displayName: `Box ${index + 1}`,
        quota: GIB,
      }),
    ),
  )
}

export const mailboxBulkScenarios: Record<string, ScenarioDefinition> = {
  'admin-bulk': {
    description:
      'An administrator with 50 mailboxes in bulk.example; box003 has its mail store down (UI 003 US6).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => {
      setupBulk(state, 50)
      state.mailboxFailures['box003@bulk.example'] = {
        status: 503,
        type: 'temporary-failure',
        operations: ['applyMailboxBulkAction'],
        extra: { dependency: 'mailStore' },
      }
    },
  },
  'admin-bulk-100': {
    description: 'An administrator with 100 mailboxes in bulk.example (UI 003 SC-007).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => setupBulk(state, 100),
  },
  'domain-admin-no-protocol': {
    description: 'A domain administrator of bulk.example without protocol access (UI 003 US6-AS4).',
    overrides: { signedInAs: 'reseller' },
    setup: (state) => {
      setupBulk(state, 10)
      assignDomains(state, 'reseller', ['bulk.example'])
      const reseller = state.accounts.find((account) => account.username === 'reseller')!
      reseller.permissions = permissionFlags(true, { protocolAccess: false })
    },
  },
  'capabilities-bulk-limit-20': {
    description: 'The 50 bulk mailboxes with a bulk limit of 20 (UI 003 FR-054).',
    overrides: { signedInAs: 'admin', mailboxCapabilities: { bulkLimit: 20 } },
    setup: (state) => setupBulk(state, 50),
  },
}
