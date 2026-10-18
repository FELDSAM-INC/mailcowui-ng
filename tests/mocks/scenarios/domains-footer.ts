// UI 002 US7 scenarios (T088): the domain-wide footer, for an administrator and for a domain
// administrator without any flag.
import { mockDomain } from '../factories/domain'
import { mockFooter } from '../factories/domain-footer'
import { assignDomains } from './domains-base'
import type { ScenarioDefinition } from './index'
import type { ScenarioState } from './state'

function setupFooter(state: ScenarioState): void {
  state.domains = [
    mockDomain({
      name: 'plain.example',
      mailboxAddresses: ['info@plain.example'],
      aliasAddresses: [],
    }),
    mockDomain({
      name: 'footed.example',
      mailboxAddresses: ['ann@footed.example', 'bob@footed.example'],
      aliasAddresses: ['sales@footed.example'],
    }),
  ]
  state.aliasDomains = [{ name: 'alias.footed.example', target: 'footed.example' }]
  state.footers['footed.example'] = mockFooter({
    html: '<p>Kind regards</p><script>alert(1)</script>',
    plain: 'Kind regards',
    skipReplies: true,
    excludedAddresses: ['bob@footed.example', 'gone@footed.example'],
    excludedAliasDomains: ['alias.footed.example'],
  })
  assignDomains(state, 'reseller', ['plain.example', 'footed.example'])
}

export const domainsFooterScenarios: Record<string, ScenarioDefinition> = {
  footer: {
    description:
      'plain.example without a footer; footed.example with a footer (a script in its HTML, skip replies, two excluded addresses of which one no longer exists, an excluded alias domain).',
    setup: setupFooter,
    overrides: { signedInAs: 'admin' },
  },
  'footer-domain-admin': {
    description: 'The same footers for the reseller, a domain administrator without any flag.',
    setup(state) {
      setupFooter(state)
      const reseller = state.accounts.find((account) => account.username === 'reseller')!
      reseller.permissions = Object.fromEntries(
        Object.keys(reseller.permissions).map((key) => [key, false]),
      ) as typeof reseller.permissions
    },
    overrides: { signedInAs: 'reseller' },
  },
}
