// UI 002 US4 smoke test (T067, research D29): deletion is offered in the list, as in the classic
// interface. example.org cannot be deleted because of alice's mailbox; a smoke domain is deleted
// with its name typed and leaves the list.
import { expect, test } from '@playwright/test'

import { createDomain, deleteDomain, signIn, uniqueName } from './fixtures/domains-api'

test.describe('@domains delete', () => {
  test('example.org is blocked by its mailbox', async ({ page }) => {
    await signIn(page, 'admin')
    await page.goto('domains?q=example.org')
    await page.getByRole('button', { name: 'Actions for example.org' }).click()
    await expect(page.getByRole('menuitem', { name: /Delete/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await expect(page.getByRole('menu', { name: 'Actions for example.org' })).toContainText(
      'mailboxes',
    )
  })

  test('a smoke domain is deleted with its name typed', async ({ page }) => {
    const name = `${uniqueName('smoke-del')}.example`
    await signIn(page, 'admin')
    await createDomain(page, name)
    try {
      await page.goto(`domains?q=${name}`)
      await page.getByRole('button', { name: `Actions for ${name}` }).click()
      await page.getByRole('menuitem', { name: 'Delete' }).click()
      await page.getByRole('alertdialog').getByRole('textbox').fill(name)
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete domain' }).click()
      await expect(page.locator('[data-live="polite"]')).toContainText(
        `Domain ${name} has been removed`,
      )
      await expect(page.locator(`[data-entry="${name}"]`)).toHaveCount(0)
    } finally {
      await deleteDomain(page, name)
    }
  })
})
