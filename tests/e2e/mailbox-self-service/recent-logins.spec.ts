import { expect, test } from '../fixtures/test'

for (const scenario of ['account-admin', 'account-domain-admin']) {
  test(`${scenario} reads and clears the scoped mailbox's recent connections`, async ({
    page,
    mockApi,
    expectAccessible,
    expectNoHorizontalScroll,
  }) => {
    await mockApi.use(scenario)
    await page.goto('mailboxes/anna@example.org/recent-logins')
    await expect(
      page.getByRole('heading', { name: 'Seen successful connections', exact: true }),
    ).toBeVisible()
    await expect(page.locator('[data-login]')).toHaveCount(3)
    await expect(page.getByRole('main')).toContainText('anna@example.org')
    await expectAccessible()
    await expectNoHorizontalScroll()
    await page.getByRole('button', { name: 'Clear seen successful connections' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
    await expect(page.getByRole('main')).toContainText('No record')
    expect(await mockApi.countRequests('clearRecentLogins')).toBe(1)
  })
}
test('out-of-scope login history is not found', async ({ page, mockApi }) => {
  await mockApi.use('account-domain-admin')
  await page.goto('mailboxes/nobody@outside.example/recent-logins')
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible()
})
