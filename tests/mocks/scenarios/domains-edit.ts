// UI 002 US3 scenarios (T055): editing a domain section by section, as an administrator and as a
// domain administrator with and without the description flag.
import { GIB, mockDomain } from '../factories/domain'
import { assignDomains } from './domains-base'
import type { ScenarioDefinition } from './index'
import type { ScenarioState } from './state'

function setupDomainEdit(state: ScenarioState): void {
  state.domains = [
    mockDomain({
      name: 'edit.example',
      description: 'Edit Ltd',
      maxMailboxes: 10,
      maxAliases: 400,
      maxMailboxQuota: 10 * GIB,
      domainQuota: 50 * GIB,
      tags: ['a', 'b'],
      usage: {
        mailboxes: 8,
        resources: 0,
        aliases: 40,
        largestMailboxQuota: 5 * GIB,
        quotaAllocated: 30 * GIB,
        storageUsed: 12 * GIB,
        messages: 900,
      },
    }),
    mockDomain({
      name: 'stale.example',
      domainQuota: 50 * GIB,
      maxMailboxQuota: 10 * GIB,
      usage: {
        mailboxes: 3,
        resources: 0,
        aliases: 0,
        largestMailboxQuota: 5 * GIB,
        quotaAllocated: 15 * GIB,
        storageUsed: GIB,
        messages: 10,
      },
    }),
  ]
  assignDomains(state, 'reseller', ['edit.example'])
}

function domainAdmin(domainDesc: boolean) {
  return (state: ScenarioState) => {
    setupDomainEdit(state)
    state.accounts.find((account) => account.username === 'reseller')!.permissions.domainDesc =
      domainDesc
  }
}

export const domainsEditScenarios: Record<string, ScenarioDefinition> = {
  'domain-edit': {
    description:
      'edit.example with 8 mailboxes, 30 GiB allocated, a 5 GiB mailbox and the tags a and b; stale.example.',
    setup: setupDomainEdit,
    overrides: { signedInAs: 'admin' },
  },
  'domain-admin-desc': {
    description: 'The reseller with the domainDesc flag, managing edit.example.',
    setup: domainAdmin(true),
    overrides: { signedInAs: 'reseller' },
  },
  'domain-admin-no-desc': {
    description: 'The reseller without the domainDesc flag, managing edit.example.',
    setup: domainAdmin(false),
    overrides: { signedInAs: 'reseller' },
  },
  'domain-tags-over-limit': {
    description: 'tags.example has 27 tags while the tagging limit is 25.',
    setup(state) {
      state.domains = [
        mockDomain({
          name: 'tags.example',
          tags: Array.from(
            { length: 27 },
            (_, index) => `tag-${String(index + 1).padStart(2, '0')}`,
          ),
        }),
      ]
    },
    overrides: { signedInAs: 'admin', capabilities: { taggingLimit: 25 } },
  },
  'domain-usage-over-limit': {
    description: 'over.example has 12 mailboxes with a limit of 10.',
    setup(state) {
      state.domains = [
        mockDomain({
          name: 'over.example',
          maxMailboxes: 10,
          domainQuota: 50 * GIB,
          usage: {
            mailboxes: 12,
            resources: 0,
            aliases: 0,
            largestMailboxQuota: GIB,
            quotaAllocated: 12 * GIB,
            storageUsed: GIB,
            messages: 1,
          },
        }),
      ]
    },
    overrides: { signedInAs: 'admin' },
  },
}
