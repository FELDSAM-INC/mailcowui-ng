import { expect, test } from '../fixtures/test'

test('US6 a mailbox override saves and an empty value restores its domain limit', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('rate-limits-admin')
  await page.goto('mailboxes/alice@example.org#rate-limit')
  const section = page.locator('#section-rate-limit')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#rate-limit-value').fill('20')
  await page.locator('#rate-limit-frame').selectOption('hour')
  await expectAccessible()
  await section.getByRole('button', { name: /Save/ }).click()
  await expect(section).toContainText('20')
  await section.getByRole('button', { name: /^Edit / }).click()
  await page.locator('#rate-limit-value').fill('')
  await section.getByRole('button', { name: /Save/ }).click()
  await expect(section.locator('[data-effective]')).toContainText('100')
  await expectAccessible()
})

test('US6 overview links to host sections and domain administrators cannot reset buckets', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('rate-limits-domain-admin-no-flag')
  await page.goto('quarantine/rate-limits')
  await expect(page.locator('[data-list-state="ready"]')).toBeVisible()
  await expect(page.locator('[data-reset-bucket]')).toHaveCount(0)
  await expectAccessible()
  await expectNoHorizontalScroll()
  const entry = page.locator('[data-entry="domain:example.org"]')
  await entry.getByRole('link').first().click()
  await expect(page).toHaveURL(/domains\/example.org#rate-limit$/)
  await expect(page.locator('#rate-limit-acl')).toContainText('Prohibited by ACL')
  await expect(
    page.locator('#section-rate-limit').getByRole('button', { name: /^Edit / }),
  ).toHaveCount(0)
})

test('US6 administrator resets an exact bucket after explicit confirmation', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('rate-limits-admin')
  await page.goto('quarantine/rate-limits')
  await page.locator('[data-reset-bucket]').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').fill('RLabc=')
  await dialog.locator('button[type="submit"]').click()
  await expect(dialog.locator('[data-reset-bucket-confirm]')).toContainText('RLabc=')
  await expectAccessible()
  await dialog.getByRole('button', { name: 'Delete now', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const writes = (await mockApi.requests()).filter((r) => r.operationId === 'resetRateLimitBucket')
  expect(writes).toHaveLength(1)
  expect(writes[0]!.path).toContain('RLabc')
})
