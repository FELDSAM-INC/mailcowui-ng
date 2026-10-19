// Recipient maps of the routing mock (UI 009 T005).
import type { RecipientMap } from '@/api'

import { routingEtag } from './routing-etag'

export interface MockRecipientMap {
  id: number
  originalDestination: string
  newDestination: string
  active: boolean
  createdAt: string
  modifiedAt: string | null
}

export function mockRecipientMap(
  values: Partial<MockRecipientMap> & { id: number },
): MockRecipientMap {
  return {
    originalDestination: `old${values.id}@old.example`,
    newDestination: `new${values.id}@new.example`,
    active: true,
    createdAt: '2026-01-05T09:00:00.000Z',
    modifiedAt: null,
    ...values,
  }
}

export const recipientMapEtag = (map: MockRecipientMap) => routingEtag('m', map)

export function recipientMapView(map: MockRecipientMap): RecipientMap {
  return { ...map, etag: recipientMapEtag(map) }
}
