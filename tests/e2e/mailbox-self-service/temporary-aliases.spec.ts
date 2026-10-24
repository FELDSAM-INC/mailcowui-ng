import { expect, test } from '../fixtures/test'

for (const scenario of ['account-admin', 'account-domain-admin-no-flags']) {
  test(`${scenario} generates an alias in mailbox context and its count link updates`, async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use(scenario)
    await page.goto('mailboxes/anna@example.org')
    await page.getByRole('link', { name: 'Spam email aliases (0)', exact: true }).click()
    await expect(page).toHaveURL(/mailboxes\/anna(?:@|%40)example\.org\/temporary-aliases/)
    await expect(page.getByRole('main')).toContainText('anna@example.org')
    await page.locator('[data-add-alias]').click()
    await page.getByLabel('Domain', { exact: true }).selectOption('example.com')
    await page.getByLabel('Description', { exact: true }).fill('Mailbox shop')
    await page.getByLabel('Period of validity', { exact: true }).selectOption('24')
    await page
      .locator('[data-generate-alias]')
      .getByRole('button', { name: 'Create spam alias', exact: true })
      .click()
    await expect(page.locator('[data-entry]')).toContainText('@example.com')
    await expect(page.locator('[data-entry]')).toContainText('Mailbox shop')
    await expectAccessible()
    await expectNoHorizontalScroll()
    await page.locator('[data-detail-back]').click()
    await page.locator('[data-detail-back]').click()
    await expect(
      page.getByRole('link', { name: 'Spam email aliases (1)', exact: true }),
    ).toBeVisible()
  })
}

test('an out-of-scope mailbox is not found and mailbox users cannot use the admin context', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('account-domain-admin')
  await page.goto('mailboxes/user@outside.example/temporary-aliases')
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible()
  await mockApi.use('account-mailbox')
  await page.goto('mailboxes/anna@example.org/temporary-aliases')
  await expect(page.getByRole('heading', { name: 'No access', exact: true })).toBeVisible()
})
