// A resource of the contract for component tests.
import type { Resource } from '@/api'

export function resource(overrides: Partial<Resource> = {}): Resource {
  return {
    address: 'MeetingRoom1@example.org',
    addressUnicode: 'MeetingRoom1@example.org',
    description: 'Meeting Room 1',
    domain: 'example.org',
    domainUnicode: 'example.org',
    kind: 'location',
    bookingRule: 'unlimited',
    bookingLimit: null,
    active: true,
    createdAt: '2026-02-01T08:00:00Z',
    modifiedAt: null,
    etag: '"r1"',
    ...overrides,
  }
}
