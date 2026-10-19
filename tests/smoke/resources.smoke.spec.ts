// UI 004 US7 smoke test against the API dev stack (T096), as `admin`: add "Smoke Room <time>" with
// the previewed address, give it a hard limit of 2, then delete it from the list.
import { expect, test } from '@playwright/test'

import { deleteResource, firstDomain, signIn } from './fixtures/feature-004-api'

test.describe('@feature-004 resources', () => {
  test('adds, changes and deletes a resource', async ({ page }) => {
    await signIn(page, 'admin')
    const domain = await firstDomain(page)
    const stamp = Date.now().toString(36)
    const address = `SmokeRoom${stamp}@${domain.name}`
    try {
      await page.goto('resources/new')
      await page.getByRole('textbox', { name: 'Description' }).fill(`Smoke Room ${stamp}`)
      const picker = page.getByRole('combobox', { name: 'Domain', exact: true })
      await picker.click()
      await picker.fill(domain.name)
      await page
        .getByRole('option', { name: new RegExp(domain.unicodeName) })
        .first()
        .click()
      await page.getByRole('combobox', { name: 'Kind' }).selectOption('location')
      await expect(page.locator('[data-address-preview]')).toContainText(`SmokeRoom${stamp}@`)
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(page.locator('[data-alert="success"]')).toContainText(`SmokeRoom${stamp}`)

      const section = page.locator('#section-resource')
      await section.getByRole('button', { name: /^Edit/ }).click()
      await section.getByRole('combobox', { name: 'Multiple bookings' }).selectOption('limited')
      await section.getByRole('spinbutton').fill('2')
      await section.getByRole('button', { name: 'Save changes' }).click()
      await expect(section.locator('[role="status"]').first()).toBeVisible()

      await page.goto(`resources?q=${encodeURIComponent(`Smoke Room ${stamp}`)}`)
      await page
        .locator('[data-entry]')
        .first()
        .getByRole('button', { name: /^Actions for/ })
        .click()
      await page.getByRole('menuitem', { name: 'Remove' }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
      await expect(page.locator('[data-alert="success"]')).toContainText(`SmokeRoom${stamp}`)
    } finally {
      await deleteResource(page, address)
    }
  })
})
