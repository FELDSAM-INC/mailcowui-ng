// The domain alias list's address parameters (T063, data-model §5): search, target and active
// filters, sort and paging with the contract's names; defaults are left out.
import { describe, expect, it } from 'vitest'

import { aliasDomainListSchema, toAliasDomainParams } from '@/features/alias-domains/list-state'

describe('alias domain list state', () => {
  it('sorts by name by default and leaves unset filters out', () => {
    expect(aliasDomainListSchema.sort?.default).toBe('name')
    expect(
      toAliasDomainParams({
        filters: { q: undefined, targetDomain: [], active: undefined },
        sort: undefined,
        order: undefined,
        page: 1,
        size: 25,
      }),
    ).toEqual({ limit: 25, offset: 0, sort: 'name', order: 'asc' })
  })

  it('passes search, filters, sort and page', () => {
    expect(
      toAliasDomainParams({
        filters: { q: 'legacy', targetDomain: ['example.org'], active: 'false' },
        sort: 'targetDomain',
        order: 'desc',
        page: 2,
        size: 50,
      }),
    ).toEqual({
      limit: 50,
      offset: 50,
      sort: 'targetDomain',
      order: 'desc',
      q: 'legacy',
      targetDomain: ['example.org'],
      active: false,
    })
  })
})
