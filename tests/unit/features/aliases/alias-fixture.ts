// An alias of the contract for component tests.
import type { Alias } from '@/api'

export function alias(overrides: Partial<Alias> = {}): Alias {
  return {
    id: 7,
    address: 'sales@example.org',
    addressUnicode: 'sales@example.org',
    kind: 'regular',
    domain: 'example.org',
    domainUnicode: 'example.org',
    inAliasDomain: false,
    primaryDomain: 'example.org',
    primaryDomainUnicode: 'example.org',
    destinationType: 'addresses',
    destinations: ['anna@example.org', 'bob@example.org'],
    destinationsUnicode: ['anna@example.org', 'bob@example.org'],
    active: true,
    senderAllowed: true,
    groupwareVisible: true,
    internal: false,
    publicComment: '',
    privateComment: '',
    createdAt: '2026-03-01T08:00:00Z',
    modifiedAt: null,
    orphaned: false,
    etag: '"a1"',
    ...overrides,
  }
}
