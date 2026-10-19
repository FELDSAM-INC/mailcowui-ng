// Relayhost assignment scenarios (UI 009 T039): example.org on relayhost 1 (active, with a
// username), example.net on 2 (active, no credentials); alice on 3 (inactive), bob on 5, dave on
// 4, carol dangling on 99.
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'
import { routingSetup, setupReseller } from './base'
import { assignDomainRelayhost, assignMailboxRelayhost, seedRelayhosts } from './relayhosts'

export function seedAssignments(state: ScenarioState): void {
  seedRelayhosts(state)
  for (const mailbox of state.mailboxes) mailbox.relayhostId = null
  assignDomainRelayhost(state, 'example.org', 1)
  assignDomainRelayhost(state, 'example.net', 2)
  assignMailboxRelayhost(state, 'alice@example.org', 3)
  assignMailboxRelayhost(state, 'bob@example.org', 5)
  assignMailboxRelayhost(state, 'dave@example.net', 4)
  assignMailboxRelayhost(state, 'carol@example.net', 99)
}

const reseller = (flags: { domainRelayhost: boolean; mailboxRelayhost: boolean }) =>
  routingSetup(seedAssignments, (state) => setupReseller(state, { bccMaps: false, ...flags }))

export const assignmentScenarios: Record<string, ScenarioDefinition> = {
  'routing-assignments': {
    description: 'An administrator with relayhost assignments in every state (UI 009 US2).',
    overrides: { signedInAs: 'admin' },
    setup: routingSetup(seedAssignments),
  },
  'routing-no-relayhosts': {
    description: 'An administrator without any relayhost (UI 009 US2-AS7).',
    overrides: { signedInAs: 'admin' },
    setup: routingSetup(),
  },
  'routing-da-assignments': {
    description: 'A domain administrator with both relayhost flags (UI 009 US2).',
    overrides: { signedInAs: 'reseller' },
    setup: reseller({ domainRelayhost: true, mailboxRelayhost: true }),
  },
  'routing-da-domain-flag-only': {
    description: 'A domain administrator with domainRelayhost only (UI 009 US2).',
    overrides: { signedInAs: 'reseller' },
    setup: reseller({ domainRelayhost: true, mailboxRelayhost: false }),
  },
  'routing-da-mailbox-flag-only': {
    description: 'A domain administrator with mailboxRelayhost only (UI 009 US2).',
    overrides: { signedInAs: 'reseller' },
    setup: reseller({ domainRelayhost: false, mailboxRelayhost: true }),
  },
}
