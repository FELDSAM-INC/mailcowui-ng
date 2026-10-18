// Resource factory (UI 004 research R21, API research R13): the address is derived from the ASCII
// letters and digits of the description, in their letter case. The version tag covers the stored
// `username, name, kind, multiple_bookings, active, domain` (API data-model "Version tags").
import { createHash } from 'node:crypto'

import type { MockResource } from '../scenarios/state'
import { domainPart, normaliseAddress } from './alias'

/** The derived local part of a description (legacy `preg_replace('/[^\da-z]/i', '', …)`). */
export function derivedLocalPart(description: string): string {
  return description.replace(/[^0-9a-z]/gi, '')
}

/** mailcow's stored `multiple_bookings` value. */
export function multipleBookings(resource: Pick<MockResource, 'bookingRule' | 'bookingLimit'>) {
  if (resource.bookingRule === 'alwaysFree') return 0
  if (resource.bookingRule === 'unlimited') return -1
  return resource.bookingLimit ?? 1
}

export function resourceEtag(resource: MockResource): string {
  const stored = [
    resource.address,
    resource.description,
    resource.kind,
    multipleBookings(resource),
    resource.active,
    domainPart(resource.address),
  ]
  return `"${createHash('sha256').update(JSON.stringify(stored)).digest('hex').slice(0, 24)}"`
}

/** A stored resource with the legacy defaults; the address is derived when not given. */
export function mockResource(
  overrides: Partial<MockResource> & { description: string; domain?: string },
): MockResource {
  const { domain, ...rest } = overrides
  const address =
    rest.address ?? `${derivedLocalPart(overrides.description)}@${domain ?? 'example.org'}`
  return {
    kind: 'location',
    bookingRule: 'unlimited',
    bookingLimit: null,
    active: true,
    createdAt: '2026-02-01T10:00:00.000Z',
    modifiedAt: null,
    ...rest,
    address: normaliseAddress(address),
  }
}
