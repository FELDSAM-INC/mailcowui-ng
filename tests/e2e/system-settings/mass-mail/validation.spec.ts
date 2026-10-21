import type { Page } from '@playwright/test'
import { expect, test } from '../../fixtures/test'

async function readyToSend(page: Page, include = false) {
  await page.goto('system/mass-mail/send')
  await expect(page.locator('[data-recipient-selection]')).toBeVisible()
  if (include) {
    await page.getByLabel('Include/Exclude', { exact: true }).selectOption('include')
    await page.getByLabel('Paste mailbox addresses').fill('user001@example.org')
    await page.getByRole('button', { name: 'Add addresses', exact: true }).click()
  }
  const next = page
    .locator('[data-compose-step-actions]')
    .getByRole('button', { name: 'Next', exact: true })
  if (await next.isVisible()) await next.click()
  await page.locator('#mass-sender').fill('noreply@localhost')
  await page.locator('#mass-subject').fill('Draft notice')
  await page.locator('#mass-textBody').fill('Preserve this body')
  if (await next.isVisible()) await next.click()
  else await page.getByRole('button', { name: 'Preview recipients', exact: true }).click()
  await expect(page.locator('[data-recipient-count]')).toContainText(include ? '1' : '120')
  if (await next.isVisible()) await next.click()
}
async function submit(page: Page) {
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /^Send to / })
    .click()
}

test('T033 an authoritative sender refusal opens Message and focuses its visible error', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  await mockApi.use('mass-mail-120')
  await readyToSend(page)
  await submit(page)
  await expect(page.locator('#mass-sender-error')).toBeVisible()
  await expect(page.locator('#mass-sender')).toBeFocused()
  await expect(page.locator('#mass-sender')).toHaveValue('noreply@localhost')
  await expect(page.locator('#mass-textBody')).toHaveValue('Preserve this body')
  await expect(page).toHaveURL(/mass-mail\/send$/)
  expect(await mockApi.countRequests('createMassMailJob')).toBe(1)
  await expectAccessible()
  await expectNoHorizontalScroll()
})

test('T033 mixed refusal summary links reveal the selected message or recipient step', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('mass-mail-120')
  await readyToSend(page, true)
  await mockApi.patch({
    failures: {
      createMassMailJob: {
        status: 422,
        type: 'validation-failed',
        times: 1,
        errors: {
          sender: [
            { code: 'invalidFormat', params: { format: 'email' }, message: 'Private diagnostic' },
          ],
          'selection.include.0': [
            {
              code: 'notEligible',
              params: { reason: 'notReceiving' },
              message: 'Private diagnostic',
            },
          ],
        },
      },
    },
  })
  await submit(page)
  const senderLink = page.locator('a[href="#mass-sender"]')
  const recipientLink = page.locator('a[href="#mass-mailboxes"]')
  await expect(recipientLink).toContainText('This mailbox cannot receive mail.')
  await expect(page.locator('[data-recipient-selection]')).toBeVisible()
  await senderLink.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#mass-sender-error')).toBeVisible()
  await expect(page.locator('#mass-sender')).toBeFocused()
  await recipientLink.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-picker-item-errors]')).toContainText(
    'This mailbox cannot receive mail.',
  )
  await expect(page.locator('#mass-mailboxes')).toBeFocused()
  await expect(page.getByRole('main')).not.toContainText('Private diagnostic')
  await expectAccessible()
})

test('T033 a late refusal leaves deliberate focus outside the composer controls', async ({
  page,
  mockApi,
}) => {
  await mockApi.use('mass-mail-120')
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let received!: () => void
  const ready = new Promise<void>((resolve) => {
    received = resolve
  })
  await page.route('**/api/v2/mass-mail-jobs', async (route) => {
    const response = await route.fetch()
    received()
    await held
    await route.fulfill({ response })
  })
  try {
    await readyToSend(page)
    await submit(page)
    await ready
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    const jobs = page.getByRole('link', { name: 'Mass mail jobs', exact: true }).first()
    await jobs.focus()
    await expect(jobs).toBeFocused()
    release()
    await expect(page.locator('#mass-sender-error')).toBeVisible()
    await expect(jobs).toBeFocused()
  } finally {
    release()
  }
})
