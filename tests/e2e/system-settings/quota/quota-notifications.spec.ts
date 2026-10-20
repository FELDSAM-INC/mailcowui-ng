import { expect, test } from '../../fixtures/test'

test('quota defaults, legacy explanation, preview and domain copy pointer', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  await mockApi.use('quota-defaults')
  await page.goto('system/quota-notifications')
  await expect(
    page.getByRole('heading', { name: 'Quota notifications', exact: true }).first(),
  ).toBeVisible()
  await expect(page.locator('[data-quota-notifications]')).toContainText('80%')
  await expect(page.locator('[data-default-value]')).toHaveCount(2)
  await expect(page.locator('[data-default-template]')).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'Manage copies by domain' })).toHaveAttribute(
    'href',
    /domains$/,
  )
  await page.locator('#section-notification-email summary').click()
  await page.getByRole('button', { name: 'Preview HTML template' }).click()
  const frame = page.frameLocator('iframe')
  await expect(frame.locator('body')).toContainText('user@example.org')
  await expect(frame.locator('body')).toContainText('95')
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-same-origin')
  await expectAccessible(page, { exclude: ['iframe'] })
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
})
test('subject-only save keeps projected defaults; custom values and restore roundtrip', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('quota-defaults')
  await page.goto('system/quota-notifications')
  const section = page.locator('#section-notification-email')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#quota-subject').fill('Storage warning')
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.getByRole('button', { name: /^Edit / })).toBeVisible()
  expect(
    (await mockApi.requests()).find((r) => r.operationId === 'updateQuotaNotificationSettings')
      ?.body,
  ).toEqual({ subject: 'Storage warning' })
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#quota-sender').fill('support@example.org')
  await page.locator('#section-notification-email summary').click()
  await page.locator('#quota-htmlTemplate').fill('<h1>{{username}}: {{percent}}%</h1>')
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('[data-default-value]')).toHaveCount(0)
  await expect(page.locator('[data-default-template]')).toHaveCount(0)
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.getByRole('button', { name: 'Restore default template', exact: true }).click()
  await page.locator('#quota-sender').fill('')
  await page.locator('#quota-subject').fill('')
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('[data-default-value]')).toHaveCount(2)
  await expect(page.locator('[data-default-template]')).toHaveCount(1)
})
test('invalid sender is blocked locally, conflict retains input, explicit retry uses fresh version', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('quota-defaults')
  await page.goto('system/quota-notifications')
  const section = page.locator('#section-notification-email')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#quota-sender').fill('bad')
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('#quota-sender')).toHaveAttribute('aria-invalid', 'true')
  expect(await mockApi.countRequests('updateQuotaNotificationSettings')).toBe(0)
  await page.locator('#quota-sender').fill('support@example.org')
  await mockApi.patch({
    settings: { quota: { subject: 'Changed elsewhere', etag: '"quota-new"' } },
  })
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('#quota-sender')).toHaveValue('support@example.org')
  await expect(section.getByRole('button', { name: 'Save again', exact: true })).toBeVisible()
  await section.getByRole('button', { name: 'Save again', exact: true }).click()
  await expect(section.getByRole('button', { name: /^Edit / })).toBeVisible()
  await expect(section).toContainText('Changed elsewhere')
})
test('demo mode is read-only and explicit local-domain sender refusal stays on its field', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('settings-demo-mode')
  await page.goto('system/quota-notifications')
  await expect(page.locator('#section-notification-email')).toBeVisible()
  await expect(
    page.locator('#section-notification-email button').filter({ hasText: /^Edit / }),
  ).toHaveCount(0)
  await mockApi.use('quota-custom')
  await page.goto('system/quota-notifications')
  const section = page.locator('#section-notification-email')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#quota-sender').fill('quota-warning@localhost')
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('#quota-sender')).toHaveAttribute('aria-invalid', 'true')
  expect(await mockApi.countRequests('updateQuotaNotificationSettings')).toBe(1)
  await expect(page.locator('#quota-sender')).toHaveValue('quota-warning@localhost')
})
