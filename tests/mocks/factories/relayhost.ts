// Relayhosts of the routing mock (UI 009 T005). The password is stored in the scenario state and
// never serialised: the representation says only whether one is set.
import type { Relayhost } from '@/api'

import { routingEtag } from './routing-etag'

export interface MockRelayhost {
  id: number
  host: string
  username: string | null
  /** Stored, never returned. */
  password: string | null
  active: boolean
}

export function mockRelayhost(values: Partial<MockRelayhost> & { id: number }): MockRelayhost {
  return {
    host: `relay${values.id}.example.net`,
    username: null,
    password: null,
    active: true,
    ...values,
  }
}

/** The version tag covers the credentials, never the usage. */
export function relayhostEtag(relayhost: MockRelayhost): string {
  const { id, host, username, password, active } = relayhost
  return routingEtag('r', { id, host, username, password, active })
}

export function relayhostView(
  relayhost: MockRelayhost,
  usage: { domains: number; mailboxes: number },
): Relayhost {
  return {
    id: relayhost.id,
    host: relayhost.host,
    username: relayhost.username,
    passwordSet: !!relayhost.password,
    active: relayhost.active,
    usage,
    etag: relayhostEtag(relayhost),
  }
}
