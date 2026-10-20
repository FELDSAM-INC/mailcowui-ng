import { expect, test } from '../fixtures/test'

for (const scenario of ['account-admin', 'account-domain-admin']) {
  test(`${scenario} reaches and manages a mailbox's app passwords`, async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use(scenario)
    await page.goto('mailboxes/anna@example.org')
    await page.getByRole('link', { name: 'App passwords', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'App passwords', exact: true })).toBeVisible()
    await expect(page.getByRole('main')).toContainText('anna@example.org')
    await expect(page.locator('[data-entry]')).toHaveCount(3)
    await expectAccessible()
    await expectNoHorizontalScroll()
    await page.getByRole('link', { name: 'Create app password' }).click()
    await page.getByLabel('App name', { exact: true }).fill('Admin-created')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText('anna@example.org')
    await page.getByRole('button', { name: 'Close', exact: true }).click()
    await page.getByRole('button', { name: 'Yes, I have saved it' }).click()
    await expect(page).toHaveURL(/app-passwords\/\d+$/)
    await page.getByRole('button', { name: 'generate', exact: true }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'generate', exact: true })
      .click()
    await expect(page.getByRole('dialog', { name: 'App password', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Close', exact: true }).click()
    await page.getByRole('button', { name: 'Yes, I have saved it' }).click()
    await page.goto('mailboxes/anna@example.org/app-passwords')
    await page.getByRole('button', { name: 'Remove: Admin-created', exact: true }).click()
    await page.getByRole('button', { name: 'Delete now' }).click()
    await expect(page.locator('[data-entry]')).toHaveCount(3)
  })
}
test('domain administrator without appPasswds can read, and cannot create or change', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-domain-admin-no-flags')
  await page.goto('mailboxes/anna@example.org/app-passwords')
  await expect(page.locator('[data-acl-note]')).toContainText('Manage app passwords')
  await expect(page.getByRole('link', { name: 'Create app password' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Remove:/ })).toHaveCount(0)
  await page.getByRole('link', { name: 'Edit: Laptop', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'App password: Laptop', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'generate', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0)
  await expect(page.locator('input')).toHaveCount(0)
  await expectAccessible()
  await page.goto('mailboxes/anna@example.org/app-passwords/new')
  await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
  expect(
    (await mockApi.requests()).filter((request) => request.operationId === 'createAppPassword'),
  ).toHaveLength(0)
})
test('an out-of-scope mailbox is not found', async ({ page, mockApi }) => {
  await mockApi.use('account-domain-admin')
  await page.goto('mailboxes/nobody@outside.example/app-passwords')
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible()
})
