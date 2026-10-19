// Forwarding hosts of the routing mock (UI 009 T005), identified by their stored address.
import type { ForwardingHost } from '@/api'

import { routingEtag } from './routing-etag'

export interface MockForwardingHost {
  address: string
  source: string
  spamFilter: boolean
}

export function mockForwardingHost(
  values: Partial<MockForwardingHost> & { address: string },
): MockForwardingHost {
  return { source: values.address, spamFilter: true, ...values }
}

export const forwardingHostEtag = (host: MockForwardingHost) => routingEtag('f', host)

export function forwardingHostView(host: MockForwardingHost): ForwardingHost {
  return { ...host, etag: forwardingHostEtag(host) }
}
