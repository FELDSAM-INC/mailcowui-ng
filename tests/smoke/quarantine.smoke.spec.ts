// @006 runs on the isolated DevelopmentSeeder stack started by scripts/smoke/stack-up.sh.
// Item 1 is a seeded message; its delivery is received by that stack's Mailpit.
import { expect, test } from '@playwright/test'

import { expectDownload } from '../e2e/fixtures/downloads'
import { signIn } from './fixtures/domains-api'
import { createMailbox, deleteMailbox, uniqueLocalPart } from './fixtures/mailboxes-api'

test('@006 quarantine item, saved message and delivery without learning use the real API', async ({
  page,
}) => {
  await signIn(page, 'admin')
  await page.goto('quarantine')
  await expect(page.locator('[data-quarantine-item]')).toHaveCount(25)
  await page.goto('quarantine/1')
  await expect(page.locator('[data-item="1"]')).toBeVisible()
  await expect(page.locator('[data-part="plain"]')).not.toBeEmpty()
  const download = await expectDownload(page, () =>
    page.locator('[data-item-action="download"]').click(),
  )
  expect(download.fileName).toMatch(/\.eml$/)
  expect(download.bytes.toString()).toContain('Subject:')
  await page.locator('[data-item-action="releaseWithoutLearning"]').click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page).toHaveURL(/\/quarantine$/)
  await expect(page.locator('[data-outcome]')).toContainText('Item 1 released')
  const gone = await page.request.get('/api/v2/quarantine/1')
  expect(gone.status()).toBe(404)
})

test('@006 mailbox notifications, spam score, policy and rate limit round trips', async ({
  page,
}) => {
  await signIn(page, 'admin')
  const mailbox = await createMailbox(page, uniqueLocalPart())
  try {
    await page.goto(`mailboxes/${mailbox.address}`)
    const section = page.locator('#section-mailbox')
    await section.getByRole('button', { name: 'Edit Edit mailbox', exact: true }).click()
    await section
      .locator('[data-notification-field="frequency"]')
      .getByRole('radio', { name: 'Weekly', exact: true })
      .check()
    await section.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(section).toContainText(`Changes to mailbox ${mailbox.address} have been saved`)
    const notifications = await page.request.get(
      `/api/v2/mailboxes/${mailbox.address}/quarantine-notification-settings`,
    )
    expect((await notifications.json()).data.frequency).toBe('weekly')
    const spam = page.locator('[data-spam-filter-section]')
    await spam.getByRole('textbox', { name: /^Junk folder from/ }).fill('6.5')
    await spam.getByRole('textbox', { name: /^Reject from/ }).fill('12')
    await spam.locator('[data-save]').click()
    await expect(spam.locator('[data-using-defaults]')).toHaveCount(0)
    const policy = spam.locator('[data-policy-list="allow"]')
    await policy.locator('[data-add-entry] input').fill('*@smoke.example')
    await policy.locator('[data-add-entry] button').click()
    await expect(policy).toContainText('*@smoke.example')
    const limit = page.locator('#section-rate-limit')
    await limit.getByRole('button', { name: /^Edit / }).click()
    await page.locator('#rate-limit-value').fill('25')
    await page.locator('#rate-limit-frame').selectOption('hour')
    await limit.getByRole('button', { name: /Save/ }).click()
    await expect(limit).toContainText('25')
    await page.reload()
    await expect(section).toContainText('Weekly')
    await expect(spam.getByRole('textbox', { name: /^Junk folder from/ })).toHaveValue('6.5')
    await expect(policy).toContainText('*@smoke.example')
    await expect(limit).toContainText('25')
  } finally {
    await deleteMailbox(page, String(mailbox.address))
  }
})

test('@006 settings reject invalid template syntax and statistics match the real API', async ({
  page,
}) => {
  await signIn(page, 'admin')
  const before = await page.request.get('/api/v2/quarantine/settings')
  expect(before.status()).toBe(200)
  const initial = (await before.json()).data.notificationTemplate
  await page.goto('quarantine/settings')
  const section = page.locator('#section-quarantine-settings')
  await section.getByRole('button', { name: /^Edit / }).click()
  await section.locator('[data-template-toggle]').click()
  await page.locator('#quarantine-settings-notificationTemplate').fill('{% for x in meta %}')
  await section.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.locator('#quarantine-settings-notificationTemplate')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  const after = await page.request.get('/api/v2/quarantine/settings')
  expect((await after.json()).data.notificationTemplate).toBe(initial)
  await page.goto('quarantine/statistics')
  const statistics = await page.request.get('/api/v2/spam-filter-action-statistics')
  expect(statistics.status()).toBe(200)
  const stats = (await statistics.json()).data
  await expect(page.locator('[data-action="rejected"] [data-count]')).toHaveText(
    new Intl.NumberFormat('en-GB').format(stats.rejected),
  )
  await expect(page.locator('[data-total]')).toContainText(
    new Intl.NumberFormat('en-GB').format(stats.total),
  )
})
