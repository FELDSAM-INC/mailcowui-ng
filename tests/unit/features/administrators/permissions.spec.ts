import { expect, it } from 'vitest'
import { domainAdminPermissionNameValues, type DomainAdminPermissions } from '@/api'
import {
  permissionOrder,
  permissionLabels,
  changedFlags,
} from '@/features/administrators/permissions'
it('preserves all classic ACL fields in their exact order, with upstream labels', () => {
  expect(permissionOrder).toEqual(domainAdminPermissionNameValues)
  expect(new Set(permissionOrder).size).toBe(19)
  for (const name of permissionOrder)
    expect(permissionLabels[name]).toMatchObject({ legacy: expect.stringMatching(/^acl\./) })
})
it('sends only changed permission flags', () => {
  const base = Object.fromEntries(
    domainAdminPermissionNameValues.map((name) => [name, true]),
  ) as DomainAdminPermissions
  expect(changedFlags(base, base)).toEqual({})
  expect(changedFlags(base, { ...base, loginAs: false, unlimitedQuota: false })).toEqual({
    loginAs: false,
    unlimitedQuota: false,
  })
})
