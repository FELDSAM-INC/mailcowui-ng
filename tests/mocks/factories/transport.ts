// Transports of the routing mock (UI 009 T005). Transports with the same next hop (ignoring letter
// case) share one username and password, which the handlers copy to each of them.
import type { Transport, TransportReference } from '@/api'

import { routingEtag } from './routing-etag'

export interface MockTransport {
  id: number
  destination: string
  nextHop: string
  mxBased: boolean
  username: string | null
  /** Stored, never returned. */
  password: string | null
  active: boolean
}

export function mockTransport(values: Partial<MockTransport> & { id: number }): MockTransport {
  return {
    destination: `dest${values.id}.example`,
    nextHop: `[mx${values.id}.example.net]:25`,
    mxBased: false,
    username: null,
    password: null,
    active: false,
    ...values,
  }
}

export function transportEtag(transport: MockTransport): string {
  const { id, destination, nextHop, mxBased, username, password, active } = transport
  return routingEtag('t', { id, destination, nextHop, mxBased, username, password, active })
}

export const sameNextHop = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

export function transportView(transport: MockTransport, all: readonly MockTransport[]): Transport {
  return {
    id: transport.id,
    destination: transport.destination,
    nextHop: transport.nextHop,
    mxBased: transport.mxBased,
    username: transport.username,
    passwordSet: !!transport.password,
    active: transport.active,
    nextHopSharedWith: all.filter(
      (other) => other.id !== transport.id && sameNextHop(other.nextHop, transport.nextHop),
    ).length,
    etag: transportEtag(transport),
  }
}

export function transportReference(transport: MockTransport): TransportReference {
  return {
    id: transport.id,
    destination: transport.destination,
    nextHop: transport.nextHop,
    etag: transportEtag(transport),
  }
}
