// The MTA-STS policy list's address parameters (T067, data-model §5, FR-054).
import { describe, expect, it } from 'vitest'

import {
  mtaStsListSchema,
  toMtaStsListParams,
  type MtaStsListState,
} from '@/features/dns/mta-sts/list-state'

const state = (
  filters: Partial<MtaStsListState['filters']>,
  extra: Partial<MtaStsListState> = {},
) =>
  ({
    filters: { q: undefined, active: undefined, mode: undefined, ...filters },
    sort: 'domain',
    order: 'asc',
    page: 1,
    size: 25,
    ...extra,
  }) as MtaStsListState

describe('MTA-STS list state', () => {
  it('maps every parameter to the query', () => {
    expect(
      toMtaStsListParams(
        state(
          { q: 'exa', active: 'false', mode: 'testing' },
          { sort: 'policyId', order: 'desc', page: 2 },
        ),
      ),
    ).toEqual({
      q: 'exa',
      active: false,
      mode: 'testing',
      sort: 'policyId',
      order: 'desc',
      limit: 25,
      offset: 25,
    })
    expect(toMtaStsListParams(state({ active: 'true' })).active).toBe(true)
    expect(toMtaStsListParams(state({}))).toEqual({
      sort: 'domain',
      order: 'asc',
      limit: 25,
      offset: 0,
    })
  })

  it('drops unknown values', () => {
    const { filters } = mtaStsListSchema
    expect(filters.mode.parse('strict')).toBeUndefined()
    expect(filters.mode.parse('none')).toBe('none')
    expect(filters.active.parse('maybe')).toBeUndefined()
    expect(filters.q.parse('a'.repeat(256))).toBeUndefined()
  })
})
