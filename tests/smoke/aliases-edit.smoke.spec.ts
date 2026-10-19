// UI 004 US3 smoke test against the API dev stack (T054), as `admin`: create an alias, change its
// destination in the "Edit alias" section, then delete it from the list after confirming.
import { expect, test } from '@playwright/test'

import { deleteAlias, firstDomain, mailboxesOf, signIn, unique } from './fixtures/feature-004-api'

test.describe('@feature-004 alias editing', () => {
  test('changes the destination of a new alias and deletes it after confirming', async ({
    page,
  }) => {
    await signIn(page, 'admin')
    const domain = await firstDomain(page)
    const mailboxes = await mailboxesOf(page, domain.name)
    test.skip(mailboxes.length === 0, 'needs a mailbox in the seeded domain')
    const address = `${unique('smoke-edit')}@${domain.name}`
    try {
      await page.goto('aliases/new')
      await page.getByLabel('Alias address/es').fill(address)
      await page.getByLabel('Goto addresses').fill(mailboxes[0]!)
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(page.locator('[data-alert="success"]')).toContainText(address)

      const section = page.locator('#section-alias')
      await section.getByRole('button', { name: 'Edit Edit alias' }).click()
      await section.getByRole('checkbox', { name: 'Silently discard mail' }).click()
      await section.getByRole('button', { name: 'Save changes' }).click()
      await expect(section.locator('[role="status"]').first()).toContainText(address)
      await expect(section.locator('[data-field="destinations"]')).toHaveText(
        'Silently discard mail',
      )

      await page.goto(`aliases?q=${encodeURIComponent(address)}`)
      await page
        .locator('[data-entry]')
        .first()
        .getByRole('button', { name: /^Actions for/ })
        .click()
      await page.getByRole('menuitem', { name: 'Remove' }).click()
      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toContainText(address)
      await dialog.getByRole('button', { name: 'Delete now' }).click()
      await expect(page.locator('[data-alert="success"]')).toContainText(address)
      await expect(page.locator('[data-empty]')).toBeVisible()
    } finally {
      await deleteAlias(page, address)
    }
  })
})
