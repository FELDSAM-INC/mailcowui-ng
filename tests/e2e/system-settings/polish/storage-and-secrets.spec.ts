import type { Page } from '@playwright/test'
import { expect, test } from '../../fixtures/test'

async function cleanStorage(page: Page, privateValues: readonly string[]) {
  const state = await page.evaluate(() => ({
    keys: [...Object.keys(localStorage), ...Object.keys(sessionStorage)],
    stored: JSON.stringify({ ...localStorage, ...sessionStorage }),
    history: JSON.stringify(history.state),
    url: location.href,
  }))
  expect(
    state.keys.filter(
      (key) =>
        ![
          'mailcowui-ng.locale',
          'mailcowui-ng.theme',
          'mailcowui-ng.announcement-collapsed',
        ].includes(key),
    ),
  ).toEqual([])
  for (const value of privateValues)
    for (const surface of [state.stored, state.history, state.url])
      expect(surface).not.toContain(value)
}

test('T172 mass-mail message and selection never enter storage or history and leave with the page', async ({
  page,
  mockApi,
  expectAccessible,
}) => {
  await mockApi.use('mass-mail-120')
  await page.goto('system/mass-mail/send')
  const privateValues = ['Private notice 9271', 'Private body 9271', 'user120@example.com']
  await page.getByLabel('Include/Exclude', { exact: true }).selectOption('exclude')
  await page.getByLabel('Paste mailbox addresses').fill(privateValues[2]!)
  await page.getByRole('button', { name: 'Add addresses', exact: true }).click()
  const next = page
    .locator('[data-compose-step-actions]')
    .getByRole('button', { name: 'Next', exact: true })
  if (await next.isVisible()) await next.click()
  await page.getByLabel('Subject', { exact: true }).fill(privateValues[0]!)
  await page.getByLabel('Text', { exact: true }).fill(privateValues[1]!)
  await cleanStorage(page, privateValues)
  if (await next.isVisible()) await next.click()
  else await page.getByRole('button', { name: 'Preview recipients', exact: true }).click()
  await expect(page.locator('[data-recipient-count]')).toContainText('119')
  if (await next.isVisible()) await next.click()
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText(privateValues[0]!)
  await cleanStorage(page, privateValues)
  await dialog.getByRole('button', { name: 'Send to 119 mailboxes' }).click()
  await expect(page).toHaveURL(/mass-mail\/jobs\/[0-9A-HJKMNP-TV-Z]{26}$/)
  await cleanStorage(page, privateValues)
  await page.getByRole('link', { name: 'Mass mail jobs', exact: true }).last().click()
  await page.getByRole('link', { name: 'Compose', exact: true }).first().click()
  await expect(page.getByLabel('Include/Exclude', { exact: true })).toHaveValue('none')
  await expect(page.locator('[data-picker-chips]')).toHaveCount(0)
  if (await next.isVisible()) await next.click()
  await expect(page.getByLabel('Subject', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Text', { exact: true })).toHaveValue('')
  await cleanStorage(page, privateValues)
  await expectAccessible()
})

test('T172 denied storage leaves representative settings, editors and jobs usable', async ({
  page,
  mockApi,
  expectAccessible,
  expectNoHorizontalScroll,
}) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    for (const name of ['localStorage', 'sessionStorage'] as const)
      Object.defineProperty(window, name, {
        configurable: true,
        get() {
          throw new DOMException('Storage denied', 'SecurityError')
        },
      })
  })
  for (const [scenario, path, ready] of [
    ['brand-colours-none', 'system/customize/colours', '#section-brand-colours'],
    ['settings-admin-defaults', 'system/password-policy', '#section-policy'],
    ['global-sieve-default', 'system/global-sieve-filters', '[data-global-filter=prefilter]'],
    ['mass-mail-none', 'system/mass-mail/jobs', '[data-jobs-empty]'],
  ]) {
    await mockApi.use(scenario!)
    await page.goto(path!)
    await expect(page.locator(ready!)).toBeVisible()
    await expectAccessible()
    await expectNoHorizontalScroll()
  }
  expect(errors).toEqual([])
})
