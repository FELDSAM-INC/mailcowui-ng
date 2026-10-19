// UI 004 US6 smoke test against the API dev stack (T084), as `admin`: two new aliases are
// deactivated, activated and then deleted with the typed count, as mass actions.
import { expect, test } from '@playwright/test'

import { deleteAlias, firstDomain, mailboxesOf, signIn, unique } from './fixtures/feature-004-api'

test.describe('@feature-004 alias mass actions', () => {
  test('deactivates, activates and deletes two aliases', async ({ page }) => {
    await signIn(page, 'admin')
    const domain = await firstDomain(page)
    const mailboxes = await mailboxesOf(page, domain.name)
    test.skip(mailboxes.length === 0, 'needs a mailbox in the seeded domain')
    const prefix = unique('smoke-bulk')
    const addresses = [`${prefix}-a@${domain.name}`, `${prefix}-b@${domain.name}`]
    try {
      await page.goto('aliases/new')
      await page.getByLabel('Alias address/es').fill(addresses.join(', '))
      await page.getByLabel('Goto addresses').fill(mailboxes[0]!)
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(page.locator('[data-create-results] [data-outcome="created"]')).toHaveCount(2)

      await page.goto(`aliases?q=${encodeURIComponent(prefix)}`)
      await page.getByRole('button', { name: 'Select', exact: true }).click()
      await page.getByRole('checkbox', { name: 'Toggle all', exact: true }).first().click()
      const bar = page.getByRole('region', { name: 'Bulk actions' })
      await bar.getByRole('button', { name: 'Deactivate', exact: true }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Deactivate' }).click()
      await expect(page.locator('[data-bulk-summary]')).toContainText('2 done')
      await page.getByRole('checkbox', { name: 'Toggle all', exact: true }).first().click()
      await bar.getByRole('button', { name: 'Activate', exact: true }).click()
      await expect(page.locator('[data-bulk-summary]')).toContainText('2 done')
      await page.getByRole('checkbox', { name: 'Toggle all', exact: true }).first().click()
      await bar.getByRole('button', { name: 'Remove', exact: true }).click()
      const dialog = page.getByRole('alertdialog')
      await dialog.getByRole('textbox', { name: 'Type 2 to confirm' }).fill('2')
      await dialog.getByRole('button', { name: 'Delete now' }).click()
      await expect(page.locator('[data-empty]')).toBeVisible()
    } finally {
      for (const address of addresses) await deleteAlias(page, address)
    }
  })
})
