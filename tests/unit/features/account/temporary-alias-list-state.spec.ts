import { expect, it } from 'vitest'
import { temporaryAliasListParams, temporaryAliasListSchema } from '@/features/account/list-state'

it('uses approved D22 validity descending, preserves false, and converts page offsets', () => {
  expect(temporaryAliasListSchema.sort?.default).toBe('expiresAt')
  expect(
    temporaryAliasListParams({
      filters: { q: 'shop', permanent: 'false' },
      sort: undefined,
      order: undefined,
      page: 2,
      size: 25,
    }),
  ).toEqual({
    q: 'shop',
    permanent: false,
    sort: 'expiresAt',
    order: 'desc',
    limit: 25,
    offset: 25,
  })
  expect(temporaryAliasListSchema.filters.permanent.parse('maybe')).toBeUndefined()
  expect(temporaryAliasListSchema.filters.q.parse('  shop  ')).toBe('shop')
})
