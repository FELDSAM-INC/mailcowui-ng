// The routing slice of the mock state (UI 009 T005, research R23): relayhosts with their stored
// passwords (never serialised), transports, BCC, recipient and TLS policy maps, forwarding hosts, a
// DNS table for forwarding host names, connection test scripts per entry and the routing
// capabilities. The relayhost assignments live on UI 002's domains (`relayhost`) and UI 003's
// mailboxes (`relayhostId`), so that their handlers report the same value. Runtime changes come
// through `routing` overrides and patches, standing in for another administrator.
import type { RoutingCapabilities, RoutingConnectionTestResult } from '@/api'

import { mockBccMap, type MockBccMap } from '../../factories/bcc-map'
import { mockForwardingHost, type MockForwardingHost } from '../../factories/forwarding-host'
import { mockRecipientMap, type MockRecipientMap } from '../../factories/recipient-map'
import { mockRelayhost, type MockRelayhost } from '../../factories/relayhost'
import { mockTlsPolicyMap, type MockTlsPolicyMap } from '../../factories/tls-policy-map'
import { mockTransport, type MockTransport } from '../../factories/transport'

export type {
  MockBccMap,
  MockForwardingHost,
  MockRecipientMap,
  MockRelayhost,
  MockTlsPolicyMap,
  MockTransport,
}

/** A host name's answer: its addresses, no address, or a temporary DNS failure. */
export type MockDnsAnswer = string[] | 'none' | 'temporaryFailure'

/**
 * How a connection test of one entry answers: a result (the defaults fill the rest), after an
 * optional delay, or never (held until the request is aborted).
 */
export type MockTestScript =
  { result: Partial<RoutingConnectionTestResult>; delayMs?: number } | { never: true }

export interface MockRoutingState {
  relayhosts: MockRelayhost[]
  transports: MockTransport[]
  bccMaps: MockBccMap[]
  recipientMaps: MockRecipientMap[]
  tlsPolicyMaps: MockTlsPolicyMap[]
  forwardingHosts: MockForwardingHost[]
  dns: Record<string, MockDnsAnswer>
  /** By `relayhost:<id>` or `transport:<id>`; an entry without a script is accepted. */
  tests: Record<string, MockTestScript>
  /** The administrator's capabilities; domain administrators get `administration: null`. */
  capabilities: RoutingCapabilities
  /** Generated mailbox choices of the BCC local destination picker, per scope domain. */
  bccChoiceExtra: number
  /** Aliases the BCC local destination picker offers, with the mailboxes they deliver to. */
  aliases: { address: string; deliversTo: string[] }[]
}

interface CollectionChanges<T, K extends string | number> {
  set?: Record<string, Partial<T>>
  add?: (Partial<T> & Record<string, unknown>)[]
  remove?: K[]
}

export interface RoutingOverrides {
  capabilities?: Partial<Omit<RoutingCapabilities, 'administration'>> & {
    administration?: Partial<NonNullable<RoutingCapabilities['administration']>>
  }
  relayhosts?: CollectionChanges<MockRelayhost, number>
  transports?: CollectionChanges<MockTransport, number>
  bccMaps?: CollectionChanges<MockBccMap, number>
  recipientMaps?: CollectionChanges<MockRecipientMap, number>
  tlsPolicyMaps?: CollectionChanges<MockTlsPolicyMap, number>
  forwardingHosts?: CollectionChanges<MockForwardingHost, string>
  dns?: Record<string, MockDnsAnswer>
  tests?: Record<string, MockTestScript>
  bccChoiceExtra?: number
}

export const TLS_POLICIES = [
  'none',
  'may',
  'encrypt',
  'dane',
  'dane-only',
  'fingerprint',
  'verify',
  'secure',
] as const

export function defaultRoutingCapabilities(): RoutingCapabilities {
  return {
    bulkLimit: 100,
    pageSize: { default: 25, maximum: 1000 },
    bccMaps: { localDestinationMaxLength: 255, bccDestinationMaxLength: 255 },
    administration: {
      connectionTest: {
        defaultSender: 'relay@example.org',
        defaultRecipient: 'null@hosted.mailcow.de',
        stepTimeoutSeconds: 15,
        totalTimeoutSeconds: 60,
      },
      maxLengths: {
        host: 255,
        nextHop: 255,
        username: 255,
        password: 255,
        transportDestination: 255,
        recipientMapDestination: 255,
        tlsPolicyDestination: 255,
        tlsPolicyParameters: 255,
        forwardingHost: 255,
        testSender: 255,
        testRecipient: 255,
      },
      tlsPolicies: [...TLS_POLICIES],
      forwardingHostDnsLookupLimit: 10,
    },
  }
}

export function initialRoutingState(): { routing: MockRoutingState } {
  return {
    routing: {
      relayhosts: [],
      transports: [],
      bccMaps: [],
      recipientMaps: [],
      tlsPolicyMaps: [],
      forwardingHosts: [],
      dns: {},
      tests: {},
      capabilities: defaultRoutingCapabilities(),
      bccChoiceExtra: 0,
      aliases: [],
    },
  }
}

function changeById<T extends { id: number }>(
  items: T[],
  changes: CollectionChanges<T, number> | undefined,
  build: (values: Partial<T> & { id: number }) => T,
): T[] {
  if (!changes) return items
  let next = [...items]
  for (const added of changes.add ?? []) {
    const id = added.id ?? Math.max(0, ...next.map((item) => item.id)) + 1
    next.push(build({ ...(added as Partial<T>), id }))
  }
  for (const [id, change] of Object.entries(changes.set ?? {})) {
    const item = next.find((entry) => entry.id === Number(id))
    if (!item) throw new Error(`Unknown routing entry ${id}`)
    Object.assign(item, change)
  }
  for (const id of changes.remove ?? []) next = next.filter((item) => item.id !== id)
  return next
}

/** Applies routing overrides or runtime patches; every stored change also changes the version tag. */
export function applyRoutingOverrides(
  state: { routing: MockRoutingState },
  overrides: RoutingOverrides | undefined,
): void {
  if (!overrides) return
  const routing = state.routing
  if (overrides.capabilities) {
    const { administration, ...rest } = overrides.capabilities
    routing.capabilities = {
      ...routing.capabilities,
      ...rest,
      administration: administration
        ? { ...routing.capabilities.administration!, ...administration }
        : routing.capabilities.administration,
    }
  }
  routing.relayhosts = changeById(routing.relayhosts, overrides.relayhosts, mockRelayhost)
  routing.transports = changeById(routing.transports, overrides.transports, mockTransport)
  routing.bccMaps = changeById(routing.bccMaps, overrides.bccMaps, (values) =>
    mockBccMap(values as Partial<MockBccMap> & { id: number; localDestination: string }),
  )
  routing.recipientMaps = changeById(routing.recipientMaps, overrides.recipientMaps, (values) =>
    mockRecipientMap(values),
  )
  routing.tlsPolicyMaps = changeById(routing.tlsPolicyMaps, overrides.tlsPolicyMaps, (values) =>
    mockTlsPolicyMap(values),
  )
  const hosts = overrides.forwardingHosts
  if (hosts) {
    for (const added of hosts.add ?? []) {
      routing.forwardingHosts.push(
        mockForwardingHost(added as Partial<MockForwardingHost> & { address: string }),
      )
    }
    for (const [address, change] of Object.entries(hosts.set ?? {})) {
      const host = routing.forwardingHosts.find((item) => item.address === address)
      if (!host) throw new Error(`Unknown forwarding host ${address}`)
      Object.assign(host, change)
    }
    for (const address of hosts.remove ?? []) {
      routing.forwardingHosts = routing.forwardingHosts.filter((item) => item.address !== address)
    }
  }
  if (overrides.dns) routing.dns = { ...routing.dns, ...overrides.dns }
  if (overrides.tests) routing.tests = { ...routing.tests, ...overrides.tests }
  if (overrides.bccChoiceExtra !== undefined) routing.bccChoiceExtra = overrides.bccChoiceExtra
}
