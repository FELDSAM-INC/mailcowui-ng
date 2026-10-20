import { expect, test } from '../fixtures/test'

test('recent connections preserve periods, service and sorting in history; clear confirms legacy wording', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-recent-logins')
  await page.goto('account/recent-logins')
  const list = page.locator('[data-recent-logins]')
  await expect(page.locator('[data-login]')).toHaveCount(4)
  await expect(page.locator('[data-login]').first()).toContainText('IMAP')
  await expect(list).toContainText('Germany')
  await expect(list).toContainText('Web/EAS/Internal (192.168.1.20)')
  await expect(list.getByRole('link', { name: 'Phone', exact: true })).toHaveAttribute(
    'href',
    /app-passwords\/2$/,
  )
  await expect(list).toContainText('CUSTOM')
  await expect(
    page.locator('[data-login]').filter({ hasText: '9.9.9.9' }).locator('[data-country]'),
  ).toHaveCount(0)
  await expectAccessible()
  await expectNoHorizontalScroll()
  await page.getByRole('combobox', { name: 'Login history', exact: true }).selectOption('31')
  await expect(page).toHaveURL(/days=31/)
  await expect(page.locator('[data-login]')).toHaveCount(5)
  await expect(list).toContainText('8.8.4.4')
  await page.getByRole('combobox', { name: 'Service', exact: true }).selectOption('SMTP')
  await expect(page.locator('[data-login]')).toHaveCount(1)
  await page.goBack()
  await expect(page.getByRole('combobox', { name: 'Service', exact: true })).toHaveValue('')
  await expect(page.locator('[data-login]')).toHaveCount(5)
  await page.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('service')
  await expect(page).toHaveURL(/sort=service/)
  await expect(page.locator('[data-login]').first()).toContainText('CUSTOM')
  await page.getByRole('button', { name: 'Clear seen successful connections' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Please confirm the deletion process.')
  await dialog.getByRole('button', { name: 'Delete now' }).click()
  await expect(page.getByRole('main')).toContainText('No record')
  await expect(page.locator('[data-login]')).toHaveCount(0)
  expect(await mockApi.countRequests('clearRecentLogins')).toBe(1)
  await expectAccessible()
})

test('no app-password permission leaves names as plain text; a failed read has a retry', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-mailbox-no-flags', { selfService: { outages: { sharedStore: true } } })
  await page.goto('account/recent-logins')
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
  await mockApi.patch({ selfService: { outages: { sharedStore: false } } })
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.locator('[data-recent-logins]')).toContainText('Phone')
  await expect(page.locator('[data-recent-logins]').getByRole('link')).toHaveCount(0)
  await expectAccessible()
})

test('the empty state and invalid URL periods are normalised; administrators have no own logins', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-recent-logins-empty')
  await page.goto('account/recent-logins?days=999')
  await expect(page).not.toHaveURL(/days=/)
  await expect(page.getByRole('combobox', { name: 'Login history', exact: true })).toHaveValue('7')
  await expect(page.getByRole('main')).toContainText('No record')
  await expectAccessible()
  await mockApi.use('account-admin')
  await page.goto('account/recent-logins')
  await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
  expect(await mockApi.countRequests('listRecentLogins')).toBe(0)
})
