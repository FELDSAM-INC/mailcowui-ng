// Temporary aliases of the mock (UI 005 T011, research R15).
import type { TemporaryAlias } from '@/api'

import type { MockTemporaryAlias } from '../scenarios/self-service/state'

export const HOUR = 3_600_000

export function mockTemporaryAlias(
  overrides: Partial<MockTemporaryAlias> & { address: string },
): MockTemporaryAlias {
  return {
    description: '',
    expiresAt: null,
    createdAt: '2026-09-01T08:00:00.000Z',
    modifiedAt: null,
    version: 1,
    ...overrides,
  }
}

export const temporaryAliasEtag = (item: MockTemporaryAlias) =>
  `"ta-${item.address.length}-${item.version}-${item.expiresAt ?? 'p'}"`

export function temporaryAliasView(mailbox: string, item: MockTemporaryAlias): TemporaryAlias {
  return {
    address: item.address,
    mailbox,
    description: item.description,
    permanent: item.expiresAt === null,
    expiresAt: item.expiresAt === null ? null : new Date(item.expiresAt).toISOString(),
    createdAt: item.createdAt,
    modifiedAt: item.modifiedAt,
    etag: temporaryAliasEtag(item),
  }
}

/** Whether a temporary alias is still valid at `now`. */
export const isLive = (item: MockTemporaryAlias, now: number) =>
  item.expiresAt === null || item.expiresAt > now
