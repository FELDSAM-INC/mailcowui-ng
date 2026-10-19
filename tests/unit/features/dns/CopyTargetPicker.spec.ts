// The copy targets (T080, FR-034): domains and alias domains with or without a key, searched by the
// server, never the source, and the entries remembered for the "has a key" marks.
import { describe, expect, it, vi } from 'vitest'

import type { DkimKey, DkimListParams } from '@/api'
import { copyTargetSource } from '@/features/dns/dkim/copy-targets'

import { dkimEntry, missingEntry } from './fixtures'

describe('copyTargetSource', () => {
  it('searches valid and missing entries, leaves out the source and remembers the entries', async () => {
    const remembered: DkimKey[] = []
    const fetchPage = vi.fn((_params: DkimListParams) =>
      Promise.resolve({
        data: [dkimEntry(), missingEntry()],
        meta: { total: 2, limit: 25, offset: 0 },
      }),
    )
    const source = copyTargetSource(
      'example.org',
      (entries) => remembered.push(...entries),
      fetchPage,
    )
    const page = await source.fetchPage({ q: 'ex', offset: 0, limit: 25 })
    expect(fetchPage.mock.calls[0]![0]).toEqual({
      state: ['valid', 'missing'],
      q: 'ex',
      sort: 'name',
      order: 'asc',
      limit: 25,
      offset: 0,
    })
    expect(page.items).toEqual([{ name: 'example.net', nameUnicode: 'example.net' }])
    expect(remembered.map((entry) => entry.name)).toEqual(['example.org', 'example.net'])
    expect(source.queryKey('ex')).toEqual(['dkim-keys', 'copy-targets', { q: 'ex' }, 'example.org'])
  })
})
