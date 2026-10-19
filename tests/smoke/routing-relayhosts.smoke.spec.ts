// UI 009 US1 smoke test (T033, research R25): as admin, a relayhost is created with a random
// username and password, found by search, edited, its password removed, and deleted; the password
// never appears in the page.
import { expect, test } from '@playwright/test'

import { signIn, uniqueName } from './fixtures/domains-api'
import { deleteEntries, findEntries, smokePassword } from './fixtures/routing-api'

const polite = '[data-live="polite"]'

test.describe('@routing relayhosts', () => {
  test('admin creates, finds, edits, clears the password of and deletes a relayhost', async ({
    page,
  }) => {
    const label = uniqueName('relay')
    const host = `[${label}.smoke.example]:587`
    const edited = `[${label}.smoke.example]:2525`
    const password = smokePassword()
    await signIn(page, 'admin')
    try {
      await page.goto('routing/relayhosts/new')
      await page.getByLabel('Host').fill(host)
      await page.getByLabel('Username').fill(`${label}@smoke.example`)
      await page.getByLabel('Password').fill(password)
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(page.locator(polite)).toContainText(host)
      expect(await page.content()).not.toContain(password)

      await page.getByRole('searchbox', { name: 'Search:' }).fill(label)
      await expect(page.locator('[data-entry]')).toHaveCount(1)
      const [created] = await findEntries(page, 'relayhosts', 'host', host)
      expect(created).toBeTruthy()
      expect(JSON.stringify(created)).not.toContain(password)

      await page.goto(`routing/relayhosts/${created!.id}`)
      await expect(page.getByText('A password is stored.')).toBeVisible()
      await expect(page.getByLabel('Password')).toHaveValue('')
      await page.getByLabel('Host').fill(edited)
      await page.getByRole('button', { name: 'Remove password' }).click()
      await page.getByRole('button', { name: 'Save changes' }).click()
      await expect(page.locator(polite)).toContainText(edited)
      expect(await page.content()).not.toContain(password)

      await page.goto(`routing/relayhosts?q=${encodeURIComponent(label)}`)
      await page.getByRole('button', { name: `Remove: ${edited}` }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
      await expect(page.locator(`[data-entry="${created!.id}"]`)).toHaveCount(0)
    } finally {
      await deleteEntries(page, 'relayhosts', 'host', host)
      await deleteEntries(page, 'relayhosts', 'host', edited)
    }
  })
})
