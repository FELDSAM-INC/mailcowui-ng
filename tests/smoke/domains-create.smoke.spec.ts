// UI 002 US2 smoke test (T049, research D29): create a smoke domain with only its name on the
// classic add domain form, see the domain page and legacy's alerts without a failure (the dev stack
// fakes outbound services), clean up.
import { expect, test } from '@playwright/test'

import { deleteDomain, signIn, uniqueName } from './fixtures/domains-api'

test.describe('@domains create', () => {
  test('admin creates a domain with only its name and reads the report', async ({ page }) => {
    const name = `${uniqueName('smoke')}.example`
    await signIn(page, 'admin')
    try {
      await page.goto('domains/-/new')
      await page.getByRole('textbox', { name: 'Domain (required)' }).fill(name)
      // "Add domain only" with the groupware, "Add" without it, as legacy.
      await page.locator('[data-sticky-save] button[type="submit"]').click()
      await expect(page.getByRole('heading', { level: 1, name: 'Edit domain' })).toBeVisible()
      await expect(page.getByRole('main').locator('header')).toContainText(name)
      const report = page.locator('[data-creation-report]')
      await expect(report).toBeVisible()
      await expect(report.locator('[data-alert="danger"]')).toHaveCount(0)
      await expect(report).toContainText(`Added domain ${name}`)
    } finally {
      await deleteDomain(page, name)
    }
  })
})
