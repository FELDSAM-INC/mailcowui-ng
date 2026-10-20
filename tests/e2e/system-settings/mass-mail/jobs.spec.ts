import { expect, test } from '../../fixtures/test'

test('empty jobs explain System mails and offer the compose route', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('mass-mail-none')
  await page.goto('system/mass-mail/jobs')
  await expect(page.getByRole('heading', { name: 'Mass mail jobs', exact: true })).toBeVisible()
  await expect(page.locator('[data-jobs-empty]')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Compose', exact: true }).first()).toHaveAttribute(
    'href',
    '/ng/system/mass-mail/send',
  )
  await expectAccessible()
  await expectNoHorizontalScroll()
})
test('completed job shows translated failure codes without raw SMTP diagnostics and safe bodies', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  await mockApi.use('mass-mail-completed')
  await page.goto('system/mass-mail/jobs')
  await page.getByRole('link', { name: 'Maintenance', exact: true }).click()
  await page.getByLabel('Recipient outcome').selectOption('failed')
  await expect(page.locator('[data-job-recipient]')).toHaveCount(6)
  await expect(page.getByRole('main')).toContainText('Mailbox is full')
  await expect(page.getByRole('main')).not.toContainText('private SMTP diagnostic')
  await expect(page.locator('[data-job-progress]')).toContainText('114')
  await expect(page.getByRole('link', { name: 'History', exact: true })).toHaveAttribute(
    'href',
    /targetType=massMailJob/,
  )
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
  await page.getByRole('button', { name: 'Preview HTML template', exact: true }).click()
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-same-origin')
  await expect(page.frameLocator('iframe').locator('body')).toContainText('maintenance notice')
})
test('running job can pause, refresh and cancel; pending recipients become skipped', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('mass-mail-running')
  await page.goto('system/mass-mail/jobs')
  await page
    .locator('[data-job-list]')
    .getByRole('link', { name: 'Maintenance', exact: true })
    .click()
  await page.getByRole('button', { name: 'Pause automatic refresh' }).click()
  await expect(page.getByRole('button', { name: 'Resume automatic refresh' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel delivery', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toContainText('already received')
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Cancel delivery', exact: true })
    .click()
  await expect(page.locator('[data-job-status]')).toHaveText('Cancelled')
  await expect(page.locator('[data-job-progress]')).toContainText('120')
  await expect(page.getByRole('button', { name: 'Pause automatic refresh' })).toHaveCount(0)
  await expectAccessible()
  await expectNoHorizontalScroll()
})
test('progress polls every five seconds, stops at completion, and refreshes recipients once', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('mass-mail-running', { massMail: { step: 40 } })
  await page.clock.install()
  await page.goto('system/mass-mail/jobs/01JQ0000000000000000000001')
  await expect(page.locator('[data-job-progress]')).toContainText('40')
  const recipients = await mockApi.countRequests('listMassMailJobRecipients')
  await page.clock.fastForward(5000)
  await expect(page.locator('[data-job-progress]')).toContainText('80')
  expect(await mockApi.countRequests('listMassMailJobRecipients')).toBe(recipients)
  await page.clock.fastForward(5000)
  await expect(page.locator('[data-job-status]')).toHaveText('Completed')
  await expect.poll(() => mockApi.countRequests('listMassMailJobRecipients')).toBe(recipients + 1)
  const reads = await mockApi.countRequests('getMassMailJob')
  await page.clock.fastForward(15_000)
  expect(await mockApi.countRequests('getMassMailJob')).toBe(reads)
})
