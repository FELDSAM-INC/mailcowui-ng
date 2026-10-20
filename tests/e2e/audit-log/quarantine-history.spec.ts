import { expect, test } from '../fixtures/test'

test('US9 quarantine settings history has its target filter and translated details', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('quarantine-audit')
  await page.goto('quarantine/settings')
  await page
    .locator('#section-quarantine-settings')
    .getByRole('link', { name: 'History', exact: true })
    .click()
  await expect(page).toHaveURL(/audit-log\?targetType=quarantineSettings$/)
  await page.getByRole('button', { name: 'Show details', exact: true }).first().click()
  await expect(page.getByRole('region', { name: /Details of/ }).first()).toContainText('2.5 KiB')
  await expectAccessible()
})

test('US9 message audit details render a bidi recipient as visible plain text', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('quarantine-audit')
  await page.goto('audit-log?targetType=quarantineItem&targetId=5')
  await page.getByRole('button', { name: 'Show details', exact: true }).first().click()
  const details = page.getByRole('region', { name: /Details of/ }).first()
  await expect(details.locator('[data-marker]')).toContainText('U+202E')
  await expect(details).toContainText('Delivery: Delivered')
  await expect(details.locator('img, script, iframe')).toHaveCount(0)
  await expectAccessible()
})

test('US9 mailbox notification history is reachable from its host section', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('quarantine-audit')
  await page.goto('mailboxes/alice@example.org')
  await page
    .locator('#section-mailbox')
    .getByRole('link', { name: /History: Quarantine notifications/ })
    .click()
  await expect(page).toHaveURL(
    /targetType=quarantineNotificationSettings&targetId=alice(?:@|%40)example.org$/,
  )
})
