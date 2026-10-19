// The query keys of UI 006 (T009, data-model §3): three roots, mailbox and owner names lower-cased
// like UI 003's keys, and prefix invalidation from each root.
import { QueryClient } from '@tanstack/vue-query'
import { describe, expect, it } from 'vitest'

import { queryKeys } from '@/api'

describe('UI 006 query keys', () => {
  it('have the shapes of data-model §3', () => {
    expect(queryKeys.quarantine.capabilities()).toEqual(['quarantine', 'capabilities'])
    expect(queryKeys.quarantine.settings()).toEqual(['quarantine', 'settings'])
    expect(queryKeys.quarantine.list({ limit: 25, sort: 'arrivedAt' })).toEqual([
      'quarantine',
      'list',
      { limit: 25, sort: 'arrivedAt' },
    ])
    expect(queryKeys.quarantine.detail(12)).toEqual(['quarantine', 'detail', 12])
    expect(queryKeys.quarantine.notificationSettings('Alice@Example.org')).toEqual([
      'quarantine',
      'notification-settings',
      'alice@example.org',
    ])
    expect(queryKeys.spamPolicy.spamScore('Alice@example.org')).toEqual([
      'spam-policy',
      'spam-score',
      'alice@example.org',
    ])
    expect(queryKeys.spamPolicy.entries('domain', 'Example.org', { list: 'allow' })).toEqual([
      'spam-policy',
      'entries',
      'domain',
      'example.org',
      { list: 'allow' },
    ])
    expect(queryKeys.spamPolicy.statistics()).toEqual(['spam-policy', 'statistics'])
    expect(queryKeys.rateLimits.list({ kind: 'mailbox' })).toEqual([
      'rate-limits',
      'list',
      { kind: 'mailbox' },
    ])
    expect(queryKeys.rateLimits.detail('mailbox', 'Alice@example.org')).toEqual([
      'rate-limits',
      'detail',
      'mailbox',
      'alice@example.org',
    ])
  })

  it('reach the lists and details through their roots', async () => {
    const client = new QueryClient()
    client.setQueryData(queryKeys.quarantine.list({ limit: 25 }), 1)
    client.setQueryData(queryKeys.quarantine.detail(1), 1)
    client.setQueryData(queryKeys.spamPolicy.entries('mailbox', 'a@b.c', { list: 'block' }), 1)
    client.setQueryData(queryKeys.rateLimits.detail('domain', 'b.c'), 1)
    await client.invalidateQueries({ queryKey: queryKeys.quarantine.lists() })
    expect(client.getQueryState(queryKeys.quarantine.list({ limit: 25 }))?.isInvalidated).toBe(true)
    expect(client.getQueryState(queryKeys.quarantine.detail(1))?.isInvalidated).toBe(false)
    await client.invalidateQueries({
      queryKey: queryKeys.spamPolicy.ownerEntries('mailbox', 'A@b.c'),
    })
    expect(
      client.getQueryState(queryKeys.spamPolicy.entries('mailbox', 'a@b.c', { list: 'block' }))
        ?.isInvalidated,
    ).toBe(true)
    await client.invalidateQueries({ queryKey: queryKeys.rateLimits.kindDetails('domain') })
    expect(client.getQueryState(queryKeys.rateLimits.detail('domain', 'b.c'))?.isInvalidated).toBe(
      true,
    )
  })
})
