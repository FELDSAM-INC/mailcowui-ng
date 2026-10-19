// UI 009 US8 smoke test (T105, research R25): as admin, 192.0.2.5/24 is added and reported as
// 192.0.2.0/24, its spam filter disabled through legacy's quick action, and deleted.
import { expect, test } from '@playwright/test'

import { signIn } from './fixtures/domains-api'
import { deleteEntries } from './fixtures/routing-api'

const NETWORK = '192.0.2.0/24'

test.describe('@routing forwarding hosts', () => {
  test('admin adds a network, disables its spam filter and deletes it', async ({ page }) => {
    await signIn(page, 'admin')
    await deleteEntries(page, 'forwarding-hosts', 'address', NETWORK)
    try {
      await page.goto('routing/forwarding-hosts/new')
      await page.getByLabel('Host').fill('192.0.2.5/24')
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(page.locator('[data-forwarding-results]')).toContainText(
        `Forwarding host ${NETWORK} has been added`,
      )
      const row = page.locator(`[data-entry="${NETWORK}"]`)
      await page.getByRole('button', { name: 'Select', exact: true }).click()
      await row.getByRole('checkbox').check()
      await page
        .getByRole('region', { name: 'Bulk actions' })
        .getByRole('button', { name: 'Disable spam filter' })
        .click()
      await expect(page.getByRole('region', { name: 'Results' })).toContainText(NETWORK)
      await page
        .getByRole('region', { name: 'Results' })
        .getByRole('button', { name: 'Close' })
        .click()
      await page.getByRole('button', { name: 'Done selecting' }).click()
      await expect(row).toContainText('✕')
      await row.getByRole('button', { name: `Remove: ${NETWORK}` }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
      await expect(page.locator('[data-live="polite"]')).toContainText(
        `Forwarding host ${NETWORK} has been removed`,
      )
    } finally {
      await deleteEntries(page, 'forwarding-hosts', 'address', NETWORK)
    }
  })
})
