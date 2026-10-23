import { openBulkActions } from '../fixtures/flows'
import { expect, test } from '../fixtures/test'

for (const [route, pattern] of [
  ['domains/example.org', '*@partner.example'],
  ['alias-domains/example.net', '*@old.example'],
  ['mailboxes/alice@example.org', '*@friends.example'],
] as const) {
  test(`US5 spam filter belongs to ${route}`, async ({ page, mockApi, expectAccessible }) => {
    await mockApi.use('policy-admin')
    await page.goto(`${route}#spam-filter`)
    const section = page.locator('[data-spam-filter-section]')
    await expect(section).toContainText(pattern)
    await expect(section.getByRole('heading', { level: 2 })).toBeFocused()
    await expectAccessible()
  })
}

test('US3 notification changes save with the mailbox section and use their own version', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('quarantine-admin')
  await page.goto('mailboxes/alice@example.org')
  const section = page.locator('#section-mailbox')
  await section.getByRole('button', { name: 'Edit Edit mailbox', exact: true }).click()
  await section
    .locator('[data-notification-field="frequency"]')
    .getByRole('radio', { name: 'Weekly', exact: true })
    .check()
  await section.locator('[data-notification-field="category"]').getByRole('radio').last().check()
  await section.getByLabel('Full name').fill('Alice edited')
  await expectAccessible()
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section).toContainText('Changes to mailbox alice@example.org have been saved')
  await expect(section).toContainText('Alice edited')
  await expect(section).toContainText('Weekly')
  const requests = await mockApi.requests()
  const notifications = requests.filter(
    (r) => r.operationId === 'updateMailboxQuarantineNotificationSettings',
  )
  expect(notifications).toHaveLength(1)
  expect(notifications[0]!.body).toEqual({ frequency: 'weekly', category: 'all' })
  expect(notifications[0]!.headers['if-match']).toBeTruthy()
  expect(requests.filter((r) => r.operationId === 'updateMailbox')).toHaveLength(1)
})

test('US3 mailbox bulk notification menu updates only explicitly selected mailboxes', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('quarantine-admin')
  await page.goto('mailboxes')
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Select alice@example.org', exact: true }).check()
  await openBulkActions(page)
  await page.locator('[data-bulk-menu="quarantine-notification"]').click()
  await page.locator('[data-bulk-action="notify-weekly"]').click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('alice@example.org')
  await expectAccessible()
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Results', exact: true })).toContainText('1 done')
  const writes = (await mockApi.requests()).filter(
    (r) => r.operationId === 'applyQuarantineNotificationBulkAction',
  )
  expect(writes).toHaveLength(1)
  expect(writes[0]!.body).toEqual({ frequency: 'weekly', targets: [{ id: 'alice@example.org' }] })
})

test('US2 recipient links open the mailbox spam-filter section and dead recipients stay text', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('quarantine-admin')
  await page.goto('quarantine/2')
  await page.locator('[data-recipient-link]').first().click()
  await expect(page).toHaveURL(/mailboxes\/alice(?:@|%40)example.org#spam-filter$/)
  await expect(page.locator('[data-spam-filter-section]')).toBeVisible()
  await mockApi.failNext('getMailbox', { status: 404 })
  await page.goto('quarantine/3')
  await expect(page.locator('[data-item="3"]')).toBeVisible()
  await expect(page.locator('[data-recipient-link]')).toHaveCount(0)
  await expect(page.locator('[data-field="recipients"]')).toContainText('alice@example.org')
})
