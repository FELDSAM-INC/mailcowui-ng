// An alias domain of the contract for component tests.
import type { AliasDomain } from '@/api'

export function aliasDomain(overrides: Partial<AliasDomain> = {}): AliasDomain {
  return {
    name: 'example.net',
    nameUnicode: 'example.net',
    targetDomain: 'example.org',
    targetDomainUnicode: 'example.org',
    targetIsRelayDomain: false,
    active: true,
    aliasCount: 7,
    rateLimit: null,
    createdAt: '2026-01-10T09:00:00Z',
    modifiedAt: null,
    etag: '"d1"',
    ...overrides,
  }
}
