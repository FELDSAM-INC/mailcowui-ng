// TLS policy maps of the routing mock (UI 009 T005).
import type { TlsPolicy, TlsPolicyMap } from '@/api'

import { routingEtag } from './routing-etag'

export interface MockTlsPolicyMap {
  id: number
  destination: string
  policy: TlsPolicy
  parameters: string
  active: boolean
  createdAt: string
  modifiedAt: string | null
}

export function mockTlsPolicyMap(
  values: Partial<MockTlsPolicyMap> & { id: number },
): MockTlsPolicyMap {
  return {
    destination: `tls${values.id}.example`,
    policy: 'encrypt',
    parameters: '',
    active: true,
    createdAt: '2026-01-05T09:00:00.000Z',
    modifiedAt: null,
    ...values,
  }
}

export const tlsPolicyMapEtag = (map: MockTlsPolicyMap) => routingEtag('p', map)

export function tlsPolicyMapView(map: MockTlsPolicyMap): TlsPolicyMap {
  return { ...map, etag: tlsPolicyMapEtag(map) }
}
