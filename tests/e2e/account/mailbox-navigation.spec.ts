import { expect, test } from '../fixtures/test'

test('D6 mailbox action areas expose registered self-service sections with the mailbox context', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-admin')
  await page.goto('mailboxes/anna@example.org')
  const header = page.getByRole('main').locator('header').first()
  await expect(header.getByRole('link', { name: 'App passwords', exact: true })).toBeVisible()
  await expect(
    header.getByRole('link', { name: 'Spam email aliases (0)', exact: true }),
  ).toBeVisible()
  await expect(header.getByRole('link', { name: 'Settings', exact: true })).toBeVisible()
  await header.getByRole('link', { name: 'Seen successful connections', exact: true }).click()
  await expect(page).toHaveURL(/\/mailboxes\/anna@example.org\/recent-logins$/)
  await expect(page.getByRole('main').locator('header').first()).toContainText('anna@example.org')
  await expectAccessible()
  await expectNoHorizontalScroll()
})

test('D6 groupware settings are hidden when disabled; domain admin app passwords stay read-only', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-domain-admin-no-flags', { selfService: { groupwareEnabled: false } })
  await page.goto('mailboxes/anna@example.org')
  const header = page.getByRole('main').locator('header').first()
  await expect(header.getByRole('link', { name: 'Settings', exact: true })).toHaveCount(0)
  await header.getByRole('link', { name: 'App passwords', exact: true }).click()
  await expect(page.locator('[data-acl-note]')).toContainText('Manage app passwords')
  await expect(page.getByRole('link', { name: 'Create app password', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'History', exact: true })).toHaveCount(0)
  await expectAccessible()
})
