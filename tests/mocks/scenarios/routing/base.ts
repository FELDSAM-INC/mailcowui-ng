// The base of the routing scenarios (UI 009 T006): the domains and mailboxes the routing data
// refers to, and the scenarios of the foundation. Each area adds its seed in its own module
// (`relayhosts.ts`, `transports.ts`, …), and `index.ts` composes `routing-admin-default` from them.
import { mockDomain } from '../../factories/domain'
import { mockMailbox, seedMailboxes } from '../../factories/mailbox'
import { permissionFlags } from '../accounts'
import { assignDomains } from '../domains-base'
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'

/** example.org (with the alias domain alias.example) and example.net, with five mailboxes. */
export function setupRoutingDomains(state: ScenarioState): void {
  state.domains.push(
    mockDomain({ name: 'example.org', maxMailboxes: 50 }),
    mockDomain({ name: 'example.net', maxMailboxes: 50 }),
    mockDomain({ name: 'example.com', maxMailboxes: 50 }),
  )
  state.aliasDomains.push({ name: 'alias.example', target: 'example.org' })
  seedMailboxes(state, [
    mockMailbox({ localPart: 'alice', domain: 'example.org', displayName: 'Alice' }),
    mockMailbox({ localPart: 'bob', domain: 'example.org', displayName: 'Bob' }),
    mockMailbox({ localPart: 'erin', domain: 'example.org', displayName: 'Erin' }),
    mockMailbox({ localPart: 'carol', domain: 'example.net', displayName: 'Carol' }),
    mockMailbox({ localPart: 'dave', domain: 'example.net', displayName: 'Dave' }),
    mockMailbox({ localPart: 'frank', domain: 'example.com', displayName: 'Frank' }),
  ])
}

/** The domain administrator `reseller` of example.org and example.net with the given flags. */
export function setupReseller(
  state: ScenarioState,
  flags: { bccMaps: boolean; domainRelayhost: boolean; mailboxRelayhost: boolean },
): void {
  assignDomains(state, 'reseller', ['example.org', 'example.net'])
  const reseller = state.accounts.find((account) => account.username === 'reseller')!
  reseller.permissions = permissionFlags(true, { loginAs: false, ...flags })
}

/** Builds a routing scenario from the domains and the given seeds. */
export function routingSetup(...seeds: ((state: ScenarioState) => void)[]) {
  return (state: ScenarioState) => {
    setupRoutingDomains(state)
    for (const seed of seeds) seed(state)
  }
}

export const routingBaseScenarios = (
  seedAll: (state: ScenarioState) => void,
): Record<string, ScenarioDefinition> => ({
  'routing-admin-empty': {
    description: 'An administrator with domains and mailboxes but no routing entries (UI 009).',
    overrides: { signedInAs: 'admin' },
    setup: routingSetup(),
  },
  'routing-admin-default': {
    description: 'An administrator with every kind of routing entry (UI 009).',
    overrides: { signedInAs: 'admin' },
    setup: routingSetup(seedAll),
  },
  'routing-da-bcc': {
    description:
      'A domain administrator of example.org and example.net with bccMaps, domainRelayhost and mailboxRelayhost (UI 009).',
    overrides: { signedInAs: 'reseller' },
    setup: routingSetup(seedAll, (state) =>
      setupReseller(state, { bccMaps: true, domainRelayhost: true, mailboxRelayhost: true }),
    ),
  },
  'routing-da-readonly': {
    description:
      'A domain administrator of example.org and example.net without any routing flag (UI 009).',
    overrides: { signedInAs: 'reseller' },
    setup: routingSetup(seedAll, (state) =>
      setupReseller(state, { bccMaps: false, domainRelayhost: false, mailboxRelayhost: false }),
    ),
  },
  'routing-mailbox-user': {
    description: 'A mailbox user, who sees no routing screen (UI 009).',
    overrides: { signedInAs: 'alice@example.org' },
    setup: routingSetup(seedAll),
  },
})
