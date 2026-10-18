// The query keys of UI 004 (T010, data-model §3): their shapes, parameters typed from the generated
// operations, and prefix invalidation, so that `['aliases']` reaches the lists and the details.
import { QueryClient } from '@tanstack/vue-query'
import { describe, expect, expectTypeOf, it } from 'vitest'

import { queryKeys, type AliasListParams, type SenderPermissionCandidateParams } from '@/api'

describe('UI 004 query keys', () => {
  it('have the shapes of data-model §3', () => {
    expect(queryKeys.capabilities.aliases()).toEqual(['capabilities', 'aliases'])
    expect(queryKeys.aliases.all()).toEqual(['aliases'])
    expect(queryKeys.aliases.lists()).toEqual(['aliases', 'list'])
    expect(queryKeys.aliases.list({ q: 'invoice', limit: 25 })).toEqual([
      'aliases',
      'list',
      { q: 'invoice', limit: 25 },
    ])
    expect(queryKeys.aliases.detail(42)).toEqual(['aliases', 'detail', 42])
    expect(queryKeys.aliasDomains.all()).toEqual(['alias-domains'])
    expect(queryKeys.aliasDomains.list({ sort: 'name' })).toEqual([
      'alias-domains',
      'list',
      { sort: 'name' },
    ])
    expect(queryKeys.aliasDomains.detail('example.net')).toEqual([
      'alias-domains',
      'detail',
      'example.net',
    ])
    expect(queryKeys.aliasDomains.options('ex')).toEqual(['alias-domains', 'options', { q: 'ex' }])
    expect(queryKeys.resources.list({})).toEqual(['resources', 'list', {}])
    expect(queryKeys.resources.detail('Room@example.org')).toEqual([
      'resources',
      'detail',
      'Room@example.org',
    ])
    expect(queryKeys.senderSettings.detail('anna@example.org')).toEqual([
      'sender-settings',
      'detail',
      'anna@example.org',
    ])
    expect(
      queryKeys.senderPermissionCandidates({
        mailbox: 'anna@example.org',
        q: 'sales',
        type: ['address', 'domain'],
      }),
    ).toEqual([
      'sender-permission-candidates',
      { mailbox: 'anna@example.org', q: 'sales', type: ['address', 'domain'] },
    ])
  })

  it('types list parameters from the generated operations', () => {
    expectTypeOf<AliasListParams['sort']>().toEqualTypeOf<
      | 'id'
      | 'address'
      | 'domain'
      | 'active'
      | 'groupwareVisible'
      | 'internal'
      | 'senderAllowed'
      | 'createdAt'
      | 'modifiedAt'
      | undefined
    >()
    expectTypeOf<SenderPermissionCandidateParams['mailbox']>().toEqualTypeOf<string>()
  })

  it('invalidates the lists and details of an area by its prefix', async () => {
    const client = new QueryClient()
    client.setQueryData(queryKeys.aliases.list({ q: 'a' }), { data: [] })
    client.setQueryData(queryKeys.aliases.detail(1), { id: 1 })
    client.setQueryData(queryKeys.aliasDomains.options(''), { pages: [] })
    await client.invalidateQueries({ queryKey: queryKeys.aliases.all() })
    expect(client.getQueryState(queryKeys.aliases.list({ q: 'a' }))?.isInvalidated).toBe(true)
    expect(client.getQueryState(queryKeys.aliases.detail(1))?.isInvalidated).toBe(true)
    expect(client.getQueryState(queryKeys.aliasDomains.options(''))?.isInvalidated).toBe(false)
    await client.invalidateQueries({ queryKey: queryKeys.aliasDomains.all() })
    expect(client.getQueryState(queryKeys.aliasDomains.options(''))?.isInvalidated).toBe(true)
  })
})
