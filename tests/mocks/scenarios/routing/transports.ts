// Transport seeds and scenarios (UI 009 T053): A and B share `[mx.partner.net]:25` with username
// u1; C routes example.com to relay.net; D is MX-based; E is `*` and inactive.
import { mockTransport } from '../../factories/transport'
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'
import { routingSetup } from './base'

export const TRANSPORT_PASSWORD = 'Partner-Secret-1'

export function seedTransports(state: ScenarioState): void {
  state.routing.transports.push(
    mockTransport({
      id: 1,
      destination: 'a.example',
      nextHop: '[mx.partner.net]:25',
      username: 'u1',
      password: TRANSPORT_PASSWORD,
      active: true,
    }),
    mockTransport({
      id: 2,
      destination: 'b.example',
      nextHop: '[mx.partner.net]:25',
      username: 'u1',
      password: TRANSPORT_PASSWORD,
      active: true,
    }),
    mockTransport({ id: 3, destination: 'example.com', nextHop: 'relay.net', active: true }),
    mockTransport({
      id: 4,
      destination: '.*\\.google\\.com',
      nextHop: '[smtp.google-relay.example]:25',
      mxBased: true,
      active: true,
    }),
    mockTransport({ id: 5, destination: '*', nextHop: '[fallback.example]:25', active: false }),
  )
}

function seedMany(state: ScenarioState): void {
  seedTransports(state)
  for (let id = 6; id <= 120; id += 1) {
    state.routing.transports.push(
      mockTransport({
        id,
        destination: `customer${String(id).padStart(3, '0')}.example`,
        nextHop: `[mx${id % 10}.partner.net]:25`,
        username: `u${id % 10}`,
        password: `Secret-${id % 10}`,
        active: true,
      }),
    )
  }
}

export const transportScenarios: Record<string, ScenarioDefinition> = {
  'routing-transports-many': {
    description: 'An administrator with 120 transports (UI 009).',
    overrides: { signedInAs: 'admin' },
    setup: routingSetup(seedMany),
  },
}
