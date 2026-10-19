// UI 009 US6 smoke test (T092, research R25): as admin, a dane-only map for a Unicode domain is
// created, shown in its ASCII form, and deleted.
import { expect, test } from '@playwright/test'

import { signIn, uniqueName } from './fixtures/domains-api'
import { deleteEntries, findEntries } from './fixtures/routing-api'

test.describe('@routing tls policy maps', () => {
  test('admin creates a dane-only map for a Unicode domain and deletes it', async ({ page }) => {
    const label = uniqueName('tls')
    const unicode = `bücher-${label}.example`
    await signIn(page, 'admin')
    let ascii = ''
    try {
      await page.goto('routing/tls-policy-maps/new')
      await page.getByLabel('Destination').fill(unicode)
      await page.getByLabel('Policy').selectOption('dane-only')
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(page.locator('[data-live="polite"]')).toContainText('xn--')
      const response = await page.request.get(
        `/api/v2/tls-policy-maps?q=${encodeURIComponent(label)}&limit=100`,
      )
      const { data } = (await response.json()) as { data: { destination: string }[] }
      ascii = data[0]!.destination
      expect(ascii).toMatch(/^xn--/)
      const [created] = await findEntries(page, 'tls-policy-maps', 'destination', ascii)
      await page.goto(`routing/tls-policy-maps?q=${encodeURIComponent(label)}`)
      await expect(page.locator(`[data-entry="${created!.id}"]`)).toContainText(ascii)
      await page.getByRole('button', { name: `Remove: ${ascii}` }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
      await expect(page.locator(`[data-entry="${created!.id}"]`)).toHaveCount(0)
    } finally {
      if (ascii) await deleteEntries(page, 'tls-policy-maps', 'destination', ascii)
    }
  })
})
