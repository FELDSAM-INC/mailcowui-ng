import { expect, it } from 'vitest'
import { planBulk } from '@/features/administrators/bulk'
const account = (
  username: string,
  active = true,
  secondFactorStatus: 'active' | 'none' = 'none',
) => ({ username, active, secondFactorStatus, etag: `"${username}-version"` })
const base = {
  role: 'domainAdmin' as const,
  action: 'activate' as const,
  selected: [account('one'), account('two')],
  ownUsername: 'admin',
  activeAdminCount: 3,
  bulkLimit: 100,
}
it('preserves each selected account version and requires no activation confirmation', () => {
  expect(planBulk(base)).toMatchObject({
    targets: [
      { id: 'one', version: '"one-version"' },
      { id: 'two', version: '"two-version"' },
    ],
    needsConfirmation: null,
  })
})
it('does not silently truncate a selection over the server limit', () => {
  expect(planBulk({ ...base, bulkLimit: 1 })).toMatchObject({ targets: [], blocked: 'tooMany' })
})
it('skips accounts without active second factors and asks once', () => {
  expect(
    planBulk({
      ...base,
      action: 'suspendSecondFactors',
      selected: [account('one', true, 'active'), account('two')],
    }),
  ).toMatchObject({
    targets: [{ id: 'one', version: '"one-version"' }],
    skippedNoSecondFactor: ['two'],
    needsConfirmation: 'simple',
  })
})
it('excludes the own administrator from deletion/deactivation and protects the last active administrator', () => {
  expect(
    planBulk({
      ...base,
      role: 'admin',
      action: 'delete',
      selected: [account('admin'), account('other')],
    }),
  ).toMatchObject({
    excludedOwn: true,
    targets: [{ id: 'other', version: '"other-version"' }],
    needsConfirmation: 'typedCount',
  })
  expect(
    planBulk({ ...base, role: 'admin', action: 'deactivate', activeAdminCount: 2 }),
  ).toMatchObject({ targets: [], blocked: 'lastActiveAdmin' })
})
