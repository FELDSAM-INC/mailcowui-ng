import { describe, expect, it } from 'vitest'
import { filterListParams, filterListSchema } from '@/features/filters/list-state'

describe('Sieve list URL state', () => {
  it('defaults to legacy descending IDs and retains explicit inactive filters', () => {
    expect(filterListSchema.sort?.default).toBe('id')
    expect(filterListSchema.sort?.defaultOrder('id')).toBe('desc')
    expect(
      filterListParams({
        filters: { mailbox: 'anna@example.org', kind: 'prefilter', active: 'no', q: undefined },
        sort: 'id',
        order: 'desc',
        page: 2,
        size: 25,
      }),
    ).toEqual({
      mailbox: 'anna@example.org',
      kind: 'prefilter',
      active: false,
      sort: 'id',
      order: 'desc',
      limit: 25,
      offset: 25,
    })
    expect(filterListSchema.filters.kind.parse('unknown')).toBeUndefined()
  })
})
