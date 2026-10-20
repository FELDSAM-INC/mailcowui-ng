// T145 complements the exhaustive pure-rule matrix in sections.spec.ts with route/render checks.
import { expect, test } from '../fixtures/test'

const denied = [
  ['pwReset', 'recoveryEmail', 'recovery-email', 'getOwnRecoveryEmail'],
  ['spamAlias', 'temporaryAliases', 'temporary-aliases', 'listTemporaryAliases'],
  ['appPasswds', 'appPasswords', 'app-passwords', 'listAppPasswords'],
  ['pushover', 'pushNotifications', 'push-notifications', 'getPushNotificationSettings'],
] as const

for (const [flag, _section, path, operation] of denied) {
  test(`FR-002 ${flag} off hides its section and refuses the direct route before reading data`, async ({
    page,
    mockApi,
  }) => {
    await mockApi.use('account-mailbox')
    await mockApi.setFlags('anna@example.org', { [flag]: false })
    await page.goto('account')
    await expect(page.getByRole('heading', { level: 1, name: 'Change password' })).toBeVisible()
    await expect(page.locator(`[data-section-nav] a[href$="/account/${path}"]`)).toHaveCount(0)
    await page.goto(`account/${path}`)
    await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
    expect(await mockApi.countRequests(operation)).toBe(0)
  })
}

test('FR-002 settings require an allowed part; the four separate flags are covered by the rule matrix', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-mailbox')
  await mockApi.setFlags('anna@example.org', {
    delimiterAction: false,
    tlsPolicy: false,
    easReset: false,
    sogoProfileReset: false,
  })
  await page.goto('account')
  await expect(page.getByRole('heading', { level: 1, name: 'Change password' })).toBeVisible()
  await expect(page.locator('[data-section-nav] a[href$="/account/mail-settings"]')).toHaveCount(0)
  await page.goto('account/mail-settings')
  await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
  expect(await mockApi.countRequests('getMailboxMailSettings')).toBe(0)
})

test('FR-004 the three domain-administrator flags remove write actions while leaving readable metadata', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-domain-admin-no-flags')
  for (const [path, selector] of [
    ['app-passwords', '[data-app-password-list]'],
    ['push-notifications', '[data-push-form]'],
    ['filters', '[data-filter-list]'],
  ]) {
    if (path === 'filters') await mockApi.use('filters-domain-admin-no-flag')
    await page.goto(`mailboxes/anna@example.org/${path}`)
    await expect(page.locator('[data-acl-note]')).toBeVisible()
    await expect(page.locator(selector!)).toBeVisible()
    await expect(
      page.getByRole('link', { name: /^(Create app password|Add filter)$/ }),
    ).toHaveCount(0)
    await expect(page.getByRole('main').locator('button[type="submit"]:enabled')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'History', exact: true })).toHaveCount(0)
  }
  await expectAccessible()
})

test('external credentials show the existing notice and refuse recovery and factor setup', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-external-source')
  await page.goto('account')
  await expect(page.getByRole('heading', { level: 1, name: 'Change password' })).toBeVisible()
  for (const path of ['recovery-email', 'two-factor'])
    await expect(page.locator(`[data-section-nav] a[href$="/account/${path}"]`)).toHaveCount(0)
  await page.goto('account/password')
  await expect(page.getByRole('main')).toContainText('Your organisation manages the password')
  await expect(page.locator('input[type="password"]')).toHaveCount(0)
  await expectAccessible()
  for (const path of ['recovery-email', 'two-factor', 'two-factor/add/totp']) {
    await page.goto(`account/${path}`)
    await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toBeVisible()
  }
  expect(await mockApi.countRequests('getOwnRecoveryEmail')).toBe(0)
  expect(await mockApi.countRequests('listOwnSecondFactors')).toBe(0)
})

test('unreadable capabilities show retry instead of asserting access was denied', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-capabilities-unavailable')
  await page.goto('account/password')
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'No access' })).toHaveCount(0)
  await expect(page.locator('[data-own-password]')).toHaveCount(0)
  await expectAccessible()
  await mockApi.patch({ failures: { getSelfServiceCapabilities: { status: 500, times: 0 } } })
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.locator('[data-own-password]')).toBeVisible()
})
