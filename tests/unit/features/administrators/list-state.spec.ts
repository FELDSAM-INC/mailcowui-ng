import { expect, it } from 'vitest'
import {
  domainAdminListSchema,
  adminListSchema,
  toAccountParams,
} from '@/features/administrators/list-state'
it('uses the same conservative defaults for both lists', () => {
  expect(adminListSchema.sort?.default).toBe('username')
  expect(domainAdminListSchema.sort?.default).toBe('username')
  expect(domainAdminListSchema.filters.permissionValue.parse(undefined)).toBe('on')
  expect(domainAdminListSchema.filters.permissionValue.serialize('on')).toBeUndefined()
})
it('maps every filter and paging value to the generated contract parameters', () => {
  expect(
    toAccountParams({
      filters: {
        q: 'example',
        status: 'inactive',
        tfa: 'suspended',
        pending: 'passwordChange',
        domain: ['example.org'],
        permission: 'loginAs',
        permissionValue: 'off',
      },
      sort: 'domainCount',
      order: 'desc',
      page: 2,
      size: 50,
    }),
  ).toEqual({
    q: 'example',
    active: false,
    secondFactorStatus: 'suspended',
    forcePasswordChange: true,
    domain: ['example.org'],
    permission: 'loginAs',
    permissionValue: false,
    sort: 'domainCount',
    order: 'desc',
    offset: 50,
    limit: 50,
  })
  expect(
    toAccountParams({
      filters: { pending: 'secondFactorSetup', permissionValue: 'off' },
      sort: 'username',
      order: 'asc',
      page: 1,
      size: 25,
    }),
  ).toEqual({ forceSecondFactorSetup: true, sort: 'username', order: 'asc', offset: 0, limit: 25 })
})
it('normalises invalid values and bounds repeated domain filters', () => {
  expect(domainAdminListSchema.filters.status.parse('unknown')).toBeUndefined()
  expect(domainAdminListSchema.filters.permission.parse('unknown')).toBeUndefined()
  expect(
    domainAdminListSchema.filters.domain.parse(
      Array.from({ length: 120 }, (_, i) => `d${i}.example`),
    ),
  ).toEqual([])
})
