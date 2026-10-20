import { describe, expect, it } from 'vitest'
import { recentLoginPeriods, recentLoginPeriodLabel } from '@/features/account/recent-login-period'
import {
  recentLoginListParams,
  recentLoginListSchema,
} from '@/features/account/recent-login-list-state'

describe('recent login periods and URL state', () => {
  it('offers legacy periods inside server limits and includes a non-standard default', () => {
    expect(recentLoginPeriods({ minDays: 1, maxDays: 31, defaultDays: 7 })).toEqual([1, 7, 14, 31])
    expect(recentLoginPeriods({ minDays: 2, maxDays: 20, defaultDays: 10 })).toEqual([7, 10, 14])
    expect(recentLoginPeriodLabel(14)).toBe('2 weeks')
  })
  it('rejects invalid periods, preserves an unknown service and defaults newest first', () => {
    const schema = recentLoginListSchema({ minDays: 1, maxDays: 31, defaultDays: 7 })
    expect(schema.filters.days.parse('999')).toBe(7)
    expect(schema.filters.days.parse('1.5')).toBe(7)
    expect(schema.filters.days.parse('14')).toBe(14)
    expect(schema.filters.service.parse('CUSTOM')).toBe('CUSTOM')
    expect(
      recentLoginListParams({
        filters: { days: 31, service: 'imap', q: '198.' },
        sort: undefined,
        order: undefined,
        page: 2,
        size: 25,
      }),
    ).toEqual({
      days: 31,
      service: 'imap',
      q: '198.',
      sort: 'lastSeenAt',
      order: 'desc',
      limit: 25,
      offset: 25,
    })
    expect(schema.sort?.defaultOrder?.('service')).toBe('asc')
  })
})
