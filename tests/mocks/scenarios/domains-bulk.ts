// UI 002 US5 scenarios (T071): bulk activation, deactivation and deletion.
import { mockDomain } from '../factories/domain'
import { assignDomains } from './domains-base'
import type { ScenarioDefinition } from './index'
import type { MockDomain, ScenarioState } from './state'

const numbered = (count: number, prefix = 'bulk'): MockDomain[] =>
  Array.from({ length: count }, (_, index) =>
    mockDomain({
      name: `${prefix}-${String(index + 1).padStart(2, '0')}.example`,
      usage: {
        mailboxes: 0,
        resources: 0,
        aliases: index % 3,
        largestMailboxQuota: 0,
        quotaAllocated: 0,
        storageUsed: 0,
        messages: 0,
      },
    }),
  )

function setupBulkMixed(state: ScenarioState): void {
  state.domains = [
    ...numbered(28),
    mockDomain({
      name: 'busy.example',
      usage: {
        mailboxes: 3,
        resources: 0,
        aliases: 0,
        largestMailboxQuota: 0,
        quotaAllocated: 0,
        storageUsed: 0,
        messages: 0,
      },
    }),
    mockDomain({
      name: 'things.example',
      usage: {
        mailboxes: 0,
        resources: 1,
        aliases: 0,
        largestMailboxQuota: 0,
        quotaAllocated: 0,
        storageUsed: 0,
        messages: 0,
      },
    }),
  ]
  state.aliasDomains = [{ name: 'alias-of-bulk-26.example', target: 'bulk-26.example' }]
  state.domainFailures = {
    'bulk-03.example': {
      status: 503,
      type: 'temporary-failure',
      operations: ['applyDomainBulkAction'],
      times: 1,
    },
    'bulk-07.example': {
      status: 503,
      type: 'temporary-failure',
      operations: ['applyDomainBulkAction'],
      times: 1,
    },
  }
  assignDomains(state, 'reseller', ['bulk-26.example', 'bulk-27.example'])
}

export const domainsBulkScenarios: Record<string, ScenarioDefinition> = {
  'bulk-mixed': {
    description:
      '30 domains; bulk-03 and bulk-07 fail once; busy.example has 3 mailboxes, things.example 1 resource.',
    setup: setupBulkMixed,
    overrides: { signedInAs: 'admin' },
  },
  'bulk-limit-small': {
    description: '30 domains with a bulk limit of 20.',
    setup(state) {
      setupBulkMixed(state)
      state.domainFailures = {}
    },
    overrides: { signedInAs: 'admin', capabilities: { bulkLimit: 20 } },
  },
  'bulk-fifty': {
    description: '50 domains (SC-008).',
    setup(state) {
      state.domains = numbered(50, 'fifty')
    },
    overrides: { signedInAs: 'admin' },
  },
}
