import { expect, test } from '../../fixtures/test'

test('T168 mailbox users cannot load new Customize settings or preset-enabled Sieve creation', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('settings-mailbox-user')
  for (const path of [
    'system/customize/colours',
    'system/customize/login-page',
    'system/customize/app-links',
    'filters/new',
    'mailboxes/anna%40example.org/filters/new',
  ]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
    await expect(page.locator('[data-preset-picker]')).toHaveCount(0)
  }
  for (const operation of [
    'getSettingsCapabilities',
    'getBrandColors',
    'getLoginPageSettings',
    'getAppLinkSettings',
    'listPresets',
  ])
    expect(await mockApi.countRequests(operation), operation).toBe(0)
  await expectAccessible()
})
