import { describe, expect, it } from 'vitest'
import { ruleListParams, ruleListSchema } from '@/features/system-settings/rule-list-state'

describe('Rspamd rules URL state (T109)', () => {
  it('uses contract ID ascending order and retains an explicit inactive filter', () => {
    expect(ruleListSchema.sort?.default).toBe('id')
    expect(ruleListSchema.sort?.defaultOrder('id')).toBe('asc')
    expect(
      ruleListParams({
        filters: { q: 'needle', active: 'no' },
        sort: 'modifiedAt',
        order: 'desc',
        page: 3,
        size: 50,
      }),
    ).toEqual({
      q: 'needle',
      active: false,
      sort: 'modifiedAt',
      order: 'desc',
      limit: 50,
      offset: 100,
    })
    expect(ruleListSchema.filters.active.parse('invalid')).toBeUndefined()
    expect(ruleListSchema.filters.q.parse('  test  ')).toBe('test')
  })
})
