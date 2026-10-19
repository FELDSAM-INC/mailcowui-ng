// Recipient map seeds (UI 009 T096): a domain map and an address map.
import { mockRecipientMap } from '../../factories/recipient-map'
import type { ScenarioState } from '../state'

export function seedRecipientMaps(state: ScenarioState): void {
  state.routing.recipientMaps.push(
    mockRecipientMap({
      id: 1,
      originalDestination: '@old.example',
      newDestination: '@new.example',
    }),
    mockRecipientMap({
      id: 2,
      originalDestination: 'bob@old.example',
      newDestination: 'robert@new.example',
      active: false,
      modifiedAt: '2026-03-01T12:00:00.000Z',
    }),
  )
}
