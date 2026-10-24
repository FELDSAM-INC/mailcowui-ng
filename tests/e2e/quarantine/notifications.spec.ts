import { expect, test } from '../fixtures/test'

test('US3 own notification settings: independent permissions, saved values and changed fields only', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('notifications-user-no-category')
  await page.goto('quarantine/notifications')
  const section = page.locator('#section-quarantine-notifications')
  await section.getByRole('button', { name: /^Edit / }).click()
  await expect(section.locator('[data-notification-field="category"]')).toContainText(
    'Prohibited by ACL',
  )
  await section.getByRole('button', { name: 'Weekly', exact: true }).click()
  await expectAccessible()
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section).toContainText('Changes to mailbox alice@example.org have been saved')
  const writes = (await mockApi.requests()).filter(
    (r) => r.operationId === 'updateMailboxQuarantineNotificationSettings',
  )
  expect(writes).toHaveLength(1)
  expect(writes[0]!.body).toEqual({ frequency: 'weekly' })
  await page.reload()
  await expect(section.locator('[data-value="frequency"]')).toContainText('Weekly')
})

test('US3 no stored category selects no option; a version conflict preserves input until Save again', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('notifications-no-category-stored')
  await page.goto('quarantine/notifications')
  const section = page.locator('#section-quarantine-notifications')
  await section.getByRole('button', { name: /^Edit / }).click()
  await expect(
    section.locator('[data-notification-field="category"] button[aria-pressed="true"]'),
  ).toHaveCount(0)
  await section.getByRole('button', { name: 'Weekly', exact: true }).click()
  await mockApi.patch({
    mailboxes: { set: { 'alice@example.org': { quarantineNotification: 'never' } } },
  })
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.locator('[data-outdated]')).toBeVisible()
  await expect(section.getByRole('button', { name: 'Weekly', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await section.getByRole('button', { name: 'Save again', exact: true }).click()
  await expect(section).toContainText('Changes to mailbox alice@example.org have been saved')
})
