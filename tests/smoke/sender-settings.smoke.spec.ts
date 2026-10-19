// UI 004 US5 smoke test against the API dev stack (T074), as `admin`: in the "Mailbox" section of
// a seeded mailbox, grant "Allow to send as" for a candidate found through the search, save, see it
// listed, then remove it and save.
import { expect, test } from '@playwright/test'

import { firstDomain, mailboxesOf, signIn } from './fixtures/feature-004-api'

test.describe('@feature-004 send as', () => {
  test('grants and revokes an explicit permission of a seeded mailbox', async ({ page }) => {
    await signIn(page, 'admin')
    const domain = await firstDomain(page)
    const mailboxes = await mailboxesOf(page, domain.name)
    test.skip(mailboxes.length < 2, 'needs two mailboxes in the seeded domain')
    const [owner, other] = mailboxes as [string, string]
    await page.goto(`mailboxes/${owner}?edit=mailbox`)
    const search = page.getByRole('combobox', { name: 'Allow to send as', exact: true })
    await search.click()
    await search.fill(other.split('@')[0]!)
    await page
      .getByRole('listbox', { name: 'Allow to send as' })
      .getByRole('option')
      .filter({ hasText: other })
      .first()
      .click()
    await page.locator('#section-mailbox').getByRole('button', { name: 'Save changes' }).click()
    await expect(page.locator('[data-value="senderAcl"]')).toContainText(other)
    await page.goto(`mailboxes/${owner}?edit=mailbox`)
    await page
      .locator(`[data-sender-entry="${other}"]`)
      .getByRole('button', { name: /^Remove/ })
      .click()
    await page.locator('#section-mailbox').getByRole('button', { name: 'Save changes' }).click()
    await expect(page.locator('[data-value="senderAcl"]')).not.toContainText(other)
  })
})
