// UI 002 US4 scenario (T064): deleting one domain after its deletion preview.
import { mockDomain } from '../factories/domain'
import { mockFooter } from '../factories/domain-footer'
import { assignDomains } from './domains-base'
import type { ScenarioDefinition } from './index'

export const domainsDeleteScenarios: Record<string, ScenarioDefinition> = {
  'domain-delete': {
    description:
      'gone.example (2 aliases, an alias domain, a footer, a DKIM key, two domain administrators), busy.example (3 mailboxes), things.example (1 resource).',
    setup(state) {
      state.domains = [
        mockDomain({
          name: 'gone.example',
          tags: ['old'],
          usage: {
            mailboxes: 0,
            resources: 0,
            aliases: 2,
            largestMailboxQuota: 0,
            quotaAllocated: 0,
            storageUsed: 0,
            messages: 0,
          },
          aliasAddresses: ['info@gone.example', 'sales@gone.example'],
        }),
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
        mockDomain({ name: 'other.example' }),
      ]
      state.aliasDomains = [{ name: 'alias-of-gone.example', target: 'gone.example' }]
      state.footers['gone.example'] = mockFooter({ plain: 'Goodbye' })
      state.dkimKeys = ['gone.example']
      assignDomains(state, 'solo', ['gone.example'])
      assignDomains(state, 'reseller', ['gone.example', 'other.example'])
    },
    overrides: { signedInAs: 'admin' },
  },
}
