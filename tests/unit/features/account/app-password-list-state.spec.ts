import { describe, expect, it } from 'vitest'
import { appPasswordListParams, appPasswordListSchema } from '@/features/account/list-state'

describe('app password list state', () => {
  it('uses contract sorts and preserves explicit false while converting pages to offsets', () => {
    expect(
      appPasswordListParams({
        filters: { q: 'Phone', active: 'no' },
        sort: 'modifiedAt',
        order: 'desc',
        page: 3,
        size: 50,
      }),
    ).toEqual({
      q: 'Phone',
      active: false,
      sort: 'modifiedAt',
      order: 'desc',
      limit: 50,
      offset: 100,
    })
    expect(appPasswordListSchema.sort?.values).toEqual([
      'name',
      'createdAt',
      'modifiedAt',
      'active',
    ])
  })
  it('drops empty and invalid filters and defaults to alphabetical order', () => {
    expect(appPasswordListSchema.filters.q.parse('  ')).toBeUndefined()
    expect(appPasswordListSchema.filters.active.parse('perhaps')).toBeUndefined()
    expect(appPasswordListSchema.filters.q.parse('  Laptop  ')).toBe('Laptop')
    expect(
      appPasswordListParams({
        filters: { q: undefined, active: undefined },
        sort: undefined,
        order: undefined,
        page: 1,
        size: 25,
      }),
    ).toEqual({ sort: 'name', order: 'asc', limit: 25, offset: 0 })
  })
})
