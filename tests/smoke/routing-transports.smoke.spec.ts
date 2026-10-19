// UI 009 US3 smoke test (T060, research R25; legacy form map decisions 5 and 10): as admin, two
// destinations to one next hop with credentials are created in one form, the password changed on
// one names the other after the save, and both are deleted in bulk with the count typed.
import { expect, test } from '@playwright/test'

import { signIn, uniqueName } from './fixtures/domains-api'
import { deleteEntries, findEntries, smokePassword } from './fixtures/routing-api'

test.describe('@routing transports', () => {
  test('admin adds two destinations to one next hop, changes a password and bulk deletes both', async ({
    page,
  }) => {
    const label = uniqueName('tr')
    const destinations = [`a-${label}.example`, `b-${label}.example`]
    const nextHop = `[${label}.smoke.example]:25`
    await signIn(page, 'admin')
    try {
      await page.goto('routing/transports/new')
      await page.getByLabel('Destination', { exact: true }).fill(destinations.join(', '))
      await page.getByLabel('Next hop', { exact: true }).fill(nextHop)
      await page.getByLabel('Username').fill(`${label}-user`)
      await page.getByLabel('Password').fill(smokePassword())
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(page).toHaveURL(/routing\/transports/)
      const [first] = await findEntries(page, 'transports', 'destination', destinations[0]!)
      expect(first).toBeTruthy()

      await page.goto(`routing/transports/${first!.id}`)
      await page.getByLabel('Password').fill(smokePassword())
      await page.getByRole('button', { name: 'Save changes' }).click()
      await expect(page.locator('[data-live="polite"]')).toContainText(destinations[1]!)

      await page.goto(`routing/transports?q=${encodeURIComponent(label)}`)
      await page.getByRole('button', { name: 'Select', exact: true }).click()
      for (const entry of await page.locator('[data-entry]').all()) {
        await entry.getByRole('checkbox').check()
      }
      await page
        .getByRole('region', { name: 'Bulk actions' })
        .getByRole('button', { name: /Remove|Delete/ })
        .click()
      const dialog = page.getByRole('alertdialog')
      await dialog.getByRole('textbox').fill('2')
      await dialog.getByRole('button', { name: /Delete/ }).click()
      await expect(page.getByRole('region', { name: 'Results' })).toBeVisible()
      for (const destination of destinations) {
        expect(await findEntries(page, 'transports', 'destination', destination)).toHaveLength(0)
      }
    } finally {
      for (const destination of destinations) {
        await deleteEntries(page, 'transports', 'destination', destination)
      }
    }
  })
})
