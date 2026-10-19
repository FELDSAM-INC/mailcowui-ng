// BCC map seeds and scenarios (UI 009 T079): sender and recipient maps, a domain-wide map, maps in
// example.org and example.net, a map in example.com (outside the domain administrator's scope) and
// an orphaned map.
import { mockBccMap } from '../../factories/bcc-map'
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'
import { routingSetup } from './base'

export function seedBccMaps(state: ScenarioState): void {
  state.routing.bccMaps.push(
    mockBccMap({ id: 1, type: 'recipient', localDestination: '@example.org' }),
    mockBccMap({
      id: 2,
      type: 'sender',
      localDestination: 'alice@example.org',
      bccDestination: 'alice-copy@archive.example',
      modifiedAt: '2026-02-01T10:00:00.000Z',
    }),
    mockBccMap({ id: 3, type: 'recipient', localDestination: 'carol@example.net' }),
    mockBccMap({ id: 4, type: 'sender', localDestination: 'frank@example.com', active: false }),
    mockBccMap({ id: 5, type: 'recipient', localDestination: '@gone.example' }),
  )
  state.routing.aliases.push(
    { address: 'sales@example.org', deliversTo: ['alice@example.org', 'bob@example.org'] },
    { address: 'info@example.net', deliversTo: ['carol@example.net'] },
    { address: 'office@example.com', deliversTo: ['frank@example.com'] },
  )
}

export const bccMapScenarios: Record<string, ScenarioDefinition> = {
  'routing-bcc-many-choices': {
    description: 'An administrator with 10,000 BCC destination choices (UI 009 SC-008).',
    overrides: { signedInAs: 'admin', routing: { bccChoiceExtra: 3333 } },
    setup: routingSetup(seedBccMaps),
  },
}
