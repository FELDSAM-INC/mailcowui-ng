// Relayhost seeds and scenarios (UI 009 T026). Relayhost 2 is used by example.org, example.net
// and three mailboxes; 3 is inactive; 4 and 5 share a host with different usernames.
import { mockRelayhost } from '../../factories/relayhost'
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'
import { routingSetup } from './base'

export const RELAYHOST_PASSWORDS = ['Relay-Secret-1', 'Alpha-Secret-4', 'Beta-Secret-5'] as const

/** Assigns a relayhost to a domain as the domain's stored `relayhost`. */
export function assignDomainRelayhost(state: ScenarioState, domain: string, id: number | null) {
  const target = state.domains.find((item) => item.name === domain)
  if (!target) throw new Error(`Unknown domain ${domain}`)
  const relayhost = state.routing.relayhosts.find((item) => item.id === id)
  target.relayhost = id === null ? null : { id, hostname: relayhost?.host ?? null }
}

export function assignMailboxRelayhost(state: ScenarioState, address: string, id: number | null) {
  const mailbox = state.mailboxes.find((item) => `${item.localPart}@${item.domain}` === address)
  if (!mailbox) throw new Error(`Unknown mailbox ${address}`)
  mailbox.relayhostId = id
}

export function seedRelayhosts(state: ScenarioState): void {
  state.routing.relayhosts.push(
    mockRelayhost({
      id: 1,
      host: '[smtp.example.net]:587',
      username: 'relay-user',
      password: RELAYHOST_PASSWORDS[0],
    }),
    mockRelayhost({ id: 2, host: 'relay.example.com' }),
    mockRelayhost({ id: 3, host: '[old-relay.example.org]:25', active: false }),
    mockRelayhost({
      id: 4,
      host: '[smarthost.example]:587',
      username: 'alpha',
      password: RELAYHOST_PASSWORDS[1],
    }),
    mockRelayhost({
      id: 5,
      host: '[smarthost.example]:587',
      username: 'beta',
      password: RELAYHOST_PASSWORDS[2],
    }),
  )
  assignDomainRelayhost(state, 'example.org', 2)
  assignDomainRelayhost(state, 'example.net', 2)
  for (const address of ['alice@example.org', 'bob@example.org', 'carol@example.net']) {
    assignMailboxRelayhost(state, address, 2)
  }
}

function seedMany(state: ScenarioState): void {
  for (let id = 1; id <= 120; id += 1) {
    state.routing.relayhosts.push(
      mockRelayhost({
        id,
        host: `[relay${String(id).padStart(3, '0')}.example.net]:587`,
        username: id % 2 === 0 ? `user${id}` : null,
        password: id % 2 === 0 ? `Secret-${id}` : null,
        active: id % 7 !== 0,
      }),
    )
  }
}

export const relayhostScenarios: Record<string, ScenarioDefinition> = {
  'routing-relayhosts-many': {
    description: 'An administrator with 120 relayhosts (UI 009 SC-009).',
    overrides: { signedInAs: 'admin' },
    setup: routingSetup(seedMany),
  },
  'routing-bulk-limit-10': {
    description: 'The default routing data with a bulk limit of 10 (UI 009 FR-016).',
    overrides: { signedInAs: 'admin', routing: { capabilities: { bulkLimit: 10 } } },
    setup: routingSetup(seedRelayhosts),
  },
}
