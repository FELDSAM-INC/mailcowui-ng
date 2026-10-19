// BCC maps of the routing mock (UI 009 T005). `orphaned` is derived from the scenario's domains
// and alias domains and is not part of the version tag.
import type { BccMap, BccMapType } from '@/api'

import { routingEtag } from './routing-etag'

export interface MockBccMap {
  id: number
  type: BccMapType
  localDestination: string
  bccDestination: string
  domain: string
  active: boolean
  createdAt: string
  modifiedAt: string | null
}

/** The domain of a local destination: `@domain` or the address's domain. */
export function domainOfDestination(value: string): string {
  return value.startsWith('@') ? value.slice(1) : value.slice(value.lastIndexOf('@') + 1)
}

export function mockBccMap(
  values: Partial<MockBccMap> & { id: number; localDestination: string },
): MockBccMap {
  return {
    type: 'recipient',
    bccDestination: 'archive@archive.example',
    domain: domainOfDestination(values.localDestination),
    active: true,
    createdAt: '2026-01-05T09:00:00.000Z',
    modifiedAt: null,
    ...values,
  }
}

export const bccMapEtag = (map: MockBccMap) => routingEtag('b', map)

export function bccMapView(map: MockBccMap, orphaned: boolean): BccMap {
  return { ...map, orphaned, etag: bccMapEtag(map) }
}
