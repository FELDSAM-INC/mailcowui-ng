// UI 009 US7 smoke test (T098, research R25): as admin, a recipient map from a domain to a domain
// is created as typed (`old.example` → `new.example`), stored and listed as `@old.example` →
// `@new.example`, and deleted.
import { expect, test } from '@playwright/test'

import { signIn, uniqueName } from './fixtures/domains-api'
import { deleteEntries, findEntries } from './fixtures/routing-api'

test.describe('@routing recipient maps', () => {
  test('admin maps one domain to another and deletes the map', async ({ page }) => {
    const label = uniqueName('rmap')
    const original = `@old-${label}.example`
    const replacement = `@new-${label}.example`
    await signIn(page, 'admin')
    try {
      await page.goto('routing/recipient-maps/new')
      await page.getByLabel('Original recipient').fill(original.slice(1))
      await page.getByLabel('New recipient').fill(replacement.slice(1))
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(page.locator('[data-live="polite"]')).toContainText(original)
      const [created] = await findEntries(page, 'recipient-maps', 'originalDestination', original)
      expect(created).toBeTruthy()
      expect(created!.newDestination).toBe(replacement)

      await page.goto(`routing/recipient-maps?q=${encodeURIComponent(label)}`)
      const row = page.locator(`[data-entry="${created!.id}"]`)
      await expect(row).toContainText(original)
      await expect(row).toContainText(replacement)
      await page.getByRole('button', { name: `Remove: ${original}` }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
      await expect(row).toHaveCount(0)
    } finally {
      await deleteEntries(page, 'recipient-maps', 'originalDestination', original)
    }
  })
})
