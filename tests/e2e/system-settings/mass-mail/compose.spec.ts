import { expect, test } from '../../fixtures/test'
import type { Page } from '@playwright/test'

async function message(page: Page) {
  await expect(page.locator('[data-recipient-selection]')).toBeVisible()
  const next = page
    .locator('[data-compose-step-actions]')
    .getByRole('button', { name: 'Next', exact: true })
  if (await next.isVisible()) {
    await next.click()
    await expect(page.getByRole('heading', { name: 'Message', exact: true })).toBeFocused()
  }
  await page.getByLabel('Subject', { exact: true }).fill('Maintenance notice')
  await page.getByLabel('Text', { exact: true }).fill('Mail service maintenance starts tonight.')
  if (await next.isVisible()) await next.click()
  else await page.getByRole('button', { name: 'Preview recipients', exact: true }).click()
}
test('previews receiving recipients and confirms the exact count before sending', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
}) => {
  await mockApi.use('mass-mail-120')
  await page.goto('system/mass-mail/send')
  await message(page)
  await expect(page.locator('[data-recipient-count]')).toContainText('120')
  await expect(page.locator('[data-recipient-preview] [data-recipient]')).toHaveCount(25)
  await page
    .locator('[data-recipient-preview]')
    .getByRole('button', { name: 'Next', exact: true })
    .click()
  await expect(page.locator('[data-recipient-preview] [data-recipient]').first()).toHaveText(
    'user026@example.org',
  )
  await page.getByLabel('Search recipients').fill('user001@')
  await expect(page.locator('[data-recipient-preview] [data-recipient]')).toHaveCount(1)
  await expect(page.locator('[data-recipient-count]')).toContainText('120')
  const next = page
    .locator('[data-compose-step-actions]')
    .getByRole('button', { name: 'Next', exact: true })
  if (await next.isVisible()) await next.click()
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Send', exact: true, includeHidden: true }),
  ).toBeDisabled()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('noreply@mail.example.org')
  await expect(confirm).toContainText('Maintenance notice')
  await expect(confirm).toContainText('cannot be recalled')
  expect(await mockApi.countRequests('createMassMailJob')).toBe(0)
  await expectAccessible()
  await expectNoHorizontalScroll()
  await expectTouchTargets()
  await confirm.getByRole('button', { name: 'Send to 120 mailboxes' }).click()
  await expect(page).toHaveURL(/mass-mail\/jobs\/[0-9A-HJKMNP-TV-Z]{26}$/)
  expect(await mockApi.countRequests('createMassMailJob')).toBe(1)
})
test('selection changes discard the preview; unknown entries are marked; draft leaving asks', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('mass-mail-120')
  await page.goto('system/mass-mail/send')
  await page.getByLabel('Include/Exclude', { exact: true }).selectOption('exclude')
  await page.getByLabel('Paste mailbox addresses').fill('ghost@example.org')
  await page.getByRole('button', { name: 'Add addresses', exact: true }).click()
  await message(page)
  await expect(page.locator('[data-picker-chips]')).toContainText('ghost@example.org')
  await expect(page.locator('[data-picker-item-errors]')).toBeVisible()
  await page.getByRole('link', { name: 'Mass mail jobs', exact: true }).first().click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  expect(await mockApi.countRequests('createMassMailJob')).toBe(0)
})
test('running-job conflict preserves the message and links to its job', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('mass-mail-running')
  await page.goto('system/mass-mail/send')
  await message(page)
  const next = page
    .locator('[data-compose-step-actions]')
    .getByRole('button', { name: 'Next', exact: true })
  if (await next.isVisible()) await next.click()
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Send to 120 mailboxes' }).click()
  await expect(page.locator('[data-running-conflict]')).toBeVisible()
  await expect(page).toHaveURL(/mass-mail\/send$/)
})
test('changed recipient count requires a fresh preview and a second explicit confirmation', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('mass-mail-120')
  await page.goto('system/mass-mail/send')
  await message(page)
  const next = page
    .locator('[data-compose-step-actions]')
    .getByRole('button', { name: 'Next', exact: true })
  if (await next.isVisible()) await next.click()
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await mockApi.patch({ mailboxes: { add: [{ localPart: 'new', domain: 'example.org' }] } })
  await page.getByRole('alertdialog').getByRole('button', { name: 'Send to 120 mailboxes' }).click()
  await expect(page.getByText('The recipient count changed.', { exact: false })).toBeVisible()
  await expect(page.locator('[data-recipient-count]')).toContainText('121')
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  expect(await mockApi.countRequests('createMassMailJob')).toBe(1)
  if (await next.isVisible()) await next.click()
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Send to 121 mailboxes' }).click()
  await expect(page).toHaveURL(/mass-mail\/jobs\/[0-9A-HJKMNP-TV-Z]{26}$/)
})
test('domain and receiving-mailbox pickers page their searches; zero selection cannot send', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('mass-mail-120')
  await page.goto('system/mass-mail/send')
  await page.getByLabel('Mailbox scope', { exact: true }).selectOption('domains')
  await page.getByRole('combobox', { name: 'Only these domains', exact: true }).fill('example.org')
  await page.getByRole('option', { name: 'example.org', exact: true }).click()
  await page.getByLabel('Include/Exclude', { exact: true }).selectOption('include')
  await page.getByRole('combobox', { name: 'Include these recipients', exact: true }).focus()
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(25)
  await page.getByRole('button', { name: 'Load more', exact: true }).click()
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(40)
  await page
    .getByRole('combobox', { name: 'Include these recipients', exact: true })
    .fill('user039')
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1)
  const request = (await mockApi.requests())
    .filter((r) => r.operationId === 'listMailboxes')
    .at(-1)!
  expect(request.path).toContain('status=active')
  expect(request.path).toContain('status=loginDisabled')
  await page.keyboard.press('Escape')
  await message(page)
  await expect(page.getByText('No receiving mailbox matches this selection.')).toBeVisible()
  expect(await mockApi.countRequests('createMassMailJob')).toBe(0)
})
test('mailbox role cannot open System mails or read job data', async ({ page, mockApi }) => {
  await mockApi.use('account-mailbox')
  await page.goto('system/mass-mail/jobs')
  await expect(page.locator('[data-job-list]')).toHaveCount(0)
  await expect(page.getByRole('main')).toBeVisible()
  expect(await mockApi.countRequests('listMassMailJobs')).toBe(0)
})
test('demo mode prevents composing and sending', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('mass-mail-120', { settings: { capabilities: { demoMode: true } } })
  await page.goto('system/mass-mail/send')
  await expect(page.locator('[data-mass-mail-demo]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toHaveCount(0)
  await expectAccessible()
  await expectNoHorizontalScroll()
})

test('invalid sender and missing content stay in the message step without previewing', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('mass-mail-120')
  await page.goto('system/mass-mail/send')
  await expect(page.locator('[data-recipient-selection]')).toBeVisible()
  const next = page
    .locator('[data-compose-step-actions]')
    .getByRole('button', { name: 'Next', exact: true })
  if (await next.isVisible()) await next.click()
  await page.locator('#mass-sender').fill('invalid')
  if (await next.isVisible()) await next.click()
  else await page.getByRole('button', { name: 'Preview recipients', exact: true }).click()
  await expect(page.locator('#mass-sender')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('#mass-subject')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('#mass-textBody')).toHaveAttribute('aria-invalid', 'true')
  expect(await mockApi.countRequests('previewMassMailRecipients')).toBe(0)
  expect(await mockApi.countRequests('createMassMailJob')).toBe(0)
})
