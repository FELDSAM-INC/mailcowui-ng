// UI 006 (T025, T080, T090): allow and block list entries (`filterconf`). A mailbox's list shows
// its own entries and, read-only, its domain's ("inherited"); a domain's list shows its own entries
// and, read-only, its mailboxes'; an alias domain has its own entries only.
import { createHash } from 'node:crypto'

import type { SpamPolicyEntry } from '@/api'

import type { MockSpamPolicyEntry } from '../scenarios/state'

export function entryCreatedAt(id: number): string {
  return new Date(Date.UTC(2026, 8, 1, 8) + id * 3_600_000).toISOString()
}

export function mockSpamPolicyEntry(
  overrides: Partial<MockSpamPolicyEntry> &
    Pick<MockSpamPolicyEntry, 'id' | 'list' | 'ownerKind' | 'owner' | 'pattern'>,
): MockSpamPolicyEntry {
  return {
    createdAt: entryCreatedAt(overrides.id),
    ...overrides,
    owner: overrides.owner.trim().toLowerCase(),
    pattern: overrides.pattern.trim().toLowerCase(),
  }
}

export function spamPolicyEntryEtag(entry: MockSpamPolicyEntry): string {
  const key = JSON.stringify([entry.id, entry.list, entry.ownerKind, entry.owner, entry.pattern])
  return `"e${createHash('sha256').update(key).digest('hex').slice(0, 23)}"`
}

/** The representation in the list of `own` owner (the owner in the request path). */
export function spamPolicyEntryView(entry: MockSpamPolicyEntry, own: boolean): SpamPolicyEntry {
  return {
    id: entry.id,
    list: entry.list,
    owner: { kind: entry.ownerKind, name: entry.owner },
    pattern: entry.pattern,
    createdAt: entry.createdAt,
    own,
    etag: spamPolicyEntryEtag(entry),
  }
}

/** `count` own entries of an owner, `a001@list.example` and so on, alternating the lists. */
export function generateEntries(
  ownerKind: MockSpamPolicyEntry['ownerKind'],
  owner: string,
  count: number,
  startId: number,
  list?: MockSpamPolicyEntry['list'],
): MockSpamPolicyEntry[] {
  return Array.from({ length: count }, (_, index) =>
    mockSpamPolicyEntry({
      id: startId + index,
      ownerKind,
      owner,
      list: list ?? (index % 2 === 0 ? 'allow' : 'block'),
      pattern: `*@s${String(index + 1).padStart(3, '0')}.list.example`,
    }),
  )
}
