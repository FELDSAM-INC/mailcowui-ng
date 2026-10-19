// UI 004 US2 smoke test against the API dev stack (T044), as `admin`: one alias with two
// destinations, three addresses of which one repeats the first, and removal through the UI.
import { expect, test } from '@playwright/test'

import { deleteAlias, firstDomain, mailboxesOf, signIn, unique } from './fixtures/feature-004-api'

test.describe('@feature-004 alias creation', () => {
  test('creates one alias, then three addresses with one refused, and removes them', async ({
    page,
  }) => {
    await signIn(page, 'admin')
    const domain = await firstDomain(page)
    const mailboxes = await mailboxesOf(page, domain.name)
    test.skip(mailboxes.length === 0, 'needs a mailbox in the seeded domain')
    const first = `${unique('smoke')}@${domain.name}`
    const second = `${unique('smoke2')}@${domain.name}`
    try {
      await page.goto('aliases/new')
      await page.getByLabel('Alias address/es').fill(first)
      await page.getByLabel('Goto addresses').fill(`${mailboxes[0]}, ${mailboxes.at(-1)}`)
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(page.locator('[data-alert="success"]')).toContainText(first)

      await page.goto('aliases/new')
      await page.getByLabel('Alias address/es').fill(`${second}, ${first}`)
      await page.getByLabel('Goto addresses').fill(mailboxes[0]!)
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      const results = page.locator('[data-create-results]')
      await expect(results.locator('[data-outcome="created"]')).toHaveCount(1)
      await expect(results.locator('[data-outcome="refused"]')).toHaveCount(1)
      await expect(page.getByLabel('Alias address/es')).toHaveValue(first)

      for (const address of [first, second]) {
        await page.goto(`aliases?q=${encodeURIComponent(address)}`)
        await page
          .locator('[data-entry]')
          .first()
          .getByRole('button', { name: /^Actions for/ })
          .click()
        await page.getByRole('menuitem', { name: 'Remove' }).click()
        await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
        await expect(page.locator('[data-empty]')).toBeVisible()
      }
    } finally {
      await deleteAlias(page, first)
      await deleteAlias(page, second)
    }
  })
})
