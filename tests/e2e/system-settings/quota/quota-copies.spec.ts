import { expect, test } from '../../fixtures/test'

test('domain administrators replace copies with pasted deduplicated entries and get no settings capability request', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('quota-copies-example-org')
  await page.goto('domains/example.org')
  const section = page.locator('#section-quota-copies')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page
    .locator('#quota-copies-recipients')
    .fill('IT@example.org; boss@example.net\nit@example.org')
  await page.locator('#quota-copies-active').check()
  await expectAccessible()
  await expectNoHorizontalScroll()
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.locator('[data-quota-copies-view]')).toContainText('IT@example.org')
  const writes = (await mockApi.requests()).filter(
    (r) => r.operationId === 'updateQuotaNotificationRecipients',
  )
  expect(writes[0]?.body).toEqual({
    recipients: ['IT@example.org', 'boss@example.net'],
    active: true,
  })
  expect(await mockApi.countRequests('getSettingsCapabilities')).toBe(0)
  await expect(section.getByRole('link', { name: 'History' })).toHaveCount(0)
})
test('invalid addresses are marked; empty active list saves inactive; scope removal retains draft with clear explanation', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('quota-copies-example-org')
  await page.goto('domains/example.org')
  const section = page.locator('#section-quota-copies')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#quota-copies-recipients').fill('not-an-address')
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('#quota-copies-recipients')).toHaveAttribute('aria-invalid', 'true')
  expect(await mockApi.countRequests('updateQuotaNotificationRecipients')).toBe(0)
  await page.locator('#quota-copies-recipients').fill('')
  await page.locator('#quota-copies-active').check()
  await expect(section).toContainText('Copies stay inactive')
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section.locator('[data-quota-copies-view]')).toContainText('No')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#quota-copies-recipients').fill('it@example.org')
  await mockApi.patch({ failures: { updateQuotaNotificationRecipients: { status: 404 } } })
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(section).toContainText('no longer available')
  await expect(page.locator('#quota-copies-recipients')).toHaveValue('it@example.org')
})
test('out-of-scope domain has no copies section; admin can edit a different domain with History', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('quota-copies-example-org')
  await page.goto('domains/example.net')
  await expect(page.locator('#section-quota-copies')).toHaveCount(0)
  await mockApi.use('quota-defaults')
  await page.goto('domains/example.net')
  const section = page.locator('#section-quota-copies')
  await expect(section.getByRole('link', { name: 'History' })).toHaveAttribute(
    'href',
    /targetType=quotaNotificationRecipients/,
  )
  await section.getByRole('button', { name: /^Edit / }).click()
  await expect(page.locator('#quota-copies-recipients')).toHaveValue('retained@example.net')
})
