import { expect, test } from '../fixtures/test'

test('an administrator changes Pushover in its legacy mailbox position', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('account-admin')
  await page.goto('mailboxes/anna@example.org#pushover')
  const section = page.locator('#pushover')
  await section.locator('input[name="token"]').fill('a'.repeat(30))
  await section.locator('input[name="userKey"]').fill('b'.repeat(30))
  await section.locator('input[name="title"]').fill('Mailbox notifications')
  await expect(section).toContainText('anna@example.org')
  await expect(section).toContainText('Only consider the following sender email addresses')
  await expectAccessible()
  await expectNoHorizontalScroll()
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.getByRole('status')).toContainText('Pushover')
  expect(await mockApi.countRequests('replacePushNotificationSettings')).toBe(1)
})

test('a domain administrator without pushover sees its stored values read-only in both mailbox contexts', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('account-domain-admin-no-flags')
  await page.goto('mailboxes/anna@example.org#pushover')
  await expect(page.locator('#pushover [data-acl-note]')).toContainText('Prohibited by ACL')
  await expect(page.locator('#pushover input[name="title"]')).toBeDisabled()
  await expect(page.locator('#pushover button[type="submit"]')).toHaveCount(0)
  await page.goto('mailboxes/anna@example.org/push-notifications')
  await expect(page.locator('input[name="title"]')).toBeDisabled()
  await expect(page.getByRole('main')).toContainText('anna@example.org')
  await expectAccessible()
})
