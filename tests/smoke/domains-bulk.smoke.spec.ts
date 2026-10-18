// UI 002 US5 smoke test (T074, research D29): two smoke domains deactivated, activated and deleted
// in bulk.
import { expect, test } from '@playwright/test'

import { createDomain, deleteDomain, signIn, uniqueName } from './fixtures/domains-api'

test.describe('@domains bulk', () => {
  test('admin deactivates, activates and deletes two domains in bulk', async ({ page }) => {
    const prefix = uniqueName('smoke-bulk')
    const names = [`${prefix}-1.example`, `${prefix}-2.example`]
    await signIn(page, 'admin')
    for (const name of names) await createDomain(page, name)
    try {
      await page.goto(`domains?q=${prefix}`)
      await page.getByRole('button', { name: 'Select', exact: true }).click()
      const bar = page.getByRole('region', { name: 'Bulk actions' })
      const results = page.getByRole('region', { name: 'Results' })
      const selectBoth = async () => {
        for (const name of names)
          await page.getByRole('checkbox', { name: `Select ${name}` }).check()
      }
      await selectBoth()
      await bar.getByRole('button', { name: 'Deactivate' }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Deactivate' }).click()
      await expect(results.locator('li', { hasText: 'Done' })).toHaveCount(2)
      await results.getByRole('button', { name: 'Close' }).click()
      await selectBoth()
      await bar.getByRole('button', { name: 'Activate', exact: true }).click()
      await expect(results.locator('li', { hasText: 'Done' })).toHaveCount(2)
      await results.getByRole('button', { name: 'Close' }).click()
      await selectBoth()
      await bar.getByRole('button', { name: 'Delete' }).click()
      await page.getByRole('alertdialog').getByRole('textbox').fill('2')
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete domains' }).click()
      await expect(results.locator('li', { hasText: 'Done' })).toHaveCount(2)
    } finally {
      for (const name of names) await deleteDomain(page, name)
    }
  })
})
