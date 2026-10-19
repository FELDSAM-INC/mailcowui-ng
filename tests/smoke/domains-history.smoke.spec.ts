// UI 002 US8 smoke test (T099): as admin, a domain created through the API and edited on its page
// shows its creation and the edit in its History (the audit log filtered by the domain).
import { expect, test } from '@playwright/test'

import { createDomain, deleteDomain, signIn, uniqueName } from './fixtures/domains-api'

test.describe('@domains history', () => {
  test('admin edits a smoke domain and its History lists the creation and the edit', async ({
    page,
  }) => {
    const name = `${uniqueName('smoke-history')}.example`
    await signIn(page, 'admin')
    await createDomain(page, name)
    try {
      await page.goto(`domains/${name}`)
      await page.getByRole('button', { name: 'Edit Edit domain' }).click()
      await page
        .locator('#section-domain')
        .getByRole('textbox', { name: 'Max. possible mailboxes', exact: true })
        .fill('25')
      await page.getByRole('button', { name: 'Save changes', exact: true }).click()
      await expect(page.locator('[data-live="polite"]')).toContainText(
        `Changes to domain ${name} have been saved`,
      )
      // The domain's own History, in the page header: UI 010's MTA-STS section has one as well.
      await page
        .getByRole('main')
        .locator('header', { has: page.getByRole('heading', { level: 1 }) })
        .getByRole('link', { name: 'History' })
        .click()
      await expect(page).toHaveURL(new RegExp(`/audit-log\\?targetId=${name.replace('.', '\\.')}`))
      const records = page.getByRole('main')
      await expect(records).toContainText('Domain added')
      await expect(records).toContainText('Domain changed')
    } finally {
      await deleteDomain(page, name)
    }
  })
})
