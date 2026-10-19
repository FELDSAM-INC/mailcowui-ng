// UI 004 US4 smoke test against the API dev stack (T064), as `admin`: add a domain alias without a
// DKIM key for a seeded domain and read legacy's alerts, deactivate it, then delete it from the list.
import { expect, test } from '@playwright/test'

import { deleteAliasDomain, firstDomain, signIn, unique } from './fixtures/feature-004-api'

test.describe('@feature-004 domain aliases', () => {
  test('adds, deactivates and deletes a domain alias', async ({ page }) => {
    await signIn(page, 'admin')
    const domain = await firstDomain(page)
    const name = `${unique('smoke')}.example`
    try {
      await page.goto('alias-domains/-/new')
      await page.getByRole('textbox', { name: 'Alias domain', exact: true }).fill(name)
      const target = page.getByRole('combobox', { name: 'Target domain', exact: true })
      await target.click()
      await target.fill(domain.name)
      await page
        .getByRole('option', { name: new RegExp(domain.unicodeName) })
        .first()
        .click()
      await page.getByRole('textbox', { name: 'Selector' }).fill('')
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(page.locator('[data-creation-report]')).toContainText(name)

      const section = page.locator('#section-general')
      await section.getByRole('button', { name: /^Edit/ }).click()
      await section.getByRole('checkbox', { name: 'Active' }).click()
      await section.getByRole('button', { name: 'Save changes' }).click()
      await expect(section.locator('[role="status"]').first()).toContainText(name)

      await page.goto(`alias-domains?q=${encodeURIComponent(name)}`)
      await page
        .locator(`[data-entry="${name}"]`)
        .getByRole('button', { name: /^Actions for/ })
        .click()
      await page.getByRole('menuitem', { name: 'Remove' }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
      await expect(page.locator('[data-alert="success"]')).toContainText(name)
    } finally {
      await deleteAliasDomain(page, name)
    }
  })
})
