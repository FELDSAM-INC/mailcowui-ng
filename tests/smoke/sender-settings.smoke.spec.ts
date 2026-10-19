// UI 004 US5 smoke test against the API dev stack (T074), as `admin`: in the "Mailbox" section of
// a seeded mailbox, grant "Allow to send as" for an alias address found through the search, save,
// see it listed, then remove it and save. Legacy offers alias addresses (and mailboxes through their
// own alias rows, which the dev seed does not have), so the test adds an alias that delivers to
// another mailbox of the domain, and deletes it afterwards.
import { expect, test } from '@playwright/test'

import {
  createAlias,
  deleteAlias,
  domainWithMailboxes,
  signIn,
  unique,
} from './fixtures/feature-004-api'

test.describe('@feature-004 send as', () => {
  test('grants and revokes an alias address for a seeded mailbox', async ({ page }) => {
    await signIn(page, 'admin')
    const found = await domainWithMailboxes(page, 2)
    test.skip(!found, 'needs a domain with two mailboxes')
    const [owner, other] = found!.mailboxes as [string, string]
    const address = `${unique('smoke-sendas')}@${found!.domain.name}`
    await createAlias(page, address, [other])
    try {
      await page.goto(`mailboxes/${owner}?edit=mailbox`)
      const search = page.getByRole('combobox', { name: 'Allow to send as', exact: true })
      await search.click()
      await search.fill(address.split('@')[0]!)
      await page
        .getByRole('listbox', { name: 'Allow to send as' })
        .getByRole('option')
        .filter({ hasText: address })
        .first()
        .click()
      await page.locator('#section-mailbox').getByRole('button', { name: 'Save changes' }).click()
      await expect(page.locator('[data-value="senderAcl"]')).toContainText(address)
      await page.goto(`mailboxes/${owner}?edit=mailbox`)
      await page
        .locator(`[data-sender-entry="${address}"]`)
        .getByRole('button', { name: /^Remove/ })
        .click()
      await page.locator('#section-mailbox').getByRole('button', { name: 'Save changes' }).click()
      await expect(page.locator('[data-value="senderAcl"]')).not.toContainText(address)
    } finally {
      await deleteAlias(page, address)
    }
  })
})
