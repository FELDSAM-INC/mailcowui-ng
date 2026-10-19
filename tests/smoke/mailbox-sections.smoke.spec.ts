// UI 003 US3 smoke tests against the API dev stack (T073, research D29): the "Mailbox" section of
// the mailbox page (legacy's "Mailbox" tab) saves the full name, the quota, the status, a
// generated password and the protocols on a mailbox created through the API; a domain
// administrator without `protocol_access` sees the protocols read-only. The mailbox is removed at
// the end.
import { expect, test, type Page } from '@playwright/test'

import { signIn } from './fixtures/domains-api'
import {
  createMailbox,
  deleteMailbox,
  readMailbox,
  SMOKE_DOMAIN,
  uniqueLocalPart,
} from './fixtures/mailboxes-api'

const GIB = 1024 ** 3
const PROTOCOLS =
  'Allowed protocols for direct user access (does not affect app password protocols)'

async function editMailboxSection(page: Page) {
  await page.getByRole('button', { name: 'Edit Edit mailbox', exact: true }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Edit mailbox' })).toBeFocused()
}

/** Saves the "Mailbox" section and waits for legacy's success in it. */
async function save(page: Page, address: string) {
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(
    page.locator('#section-mailbox').getByText(`Changes to mailbox ${address} have been saved`),
  ).toBeVisible()
}

test.describe('@mailboxes mailbox sections', () => {
  test('admin saves the full name, 2 GiB, inactive and active again, a generated password and POP3 off', async ({
    page,
  }) => {
    test.slow()
    const address = `${uniqueLocalPart()}@${SMOKE_DOMAIN}`
    await signIn(page, 'admin')
    try {
      const created = await createMailbox(page, address.split('@')[0]!)
      expect(created.protocolAccess.pop3).toBe(true)
      await page.goto(`mailboxes/${address}`)
      await expect(page.getByRole('heading', { level: 1, name: 'Edit mailbox' })).toBeVisible()
      const section = page.locator('#section-mailbox')

      // The full name, the quota in MiB and the status "Inactive" in one save.
      await editMailboxSection(page)
      await section.getByRole('textbox', { name: 'Full name', exact: true }).fill('Smoke Sections')
      await section.getByRole('textbox', { name: 'Quota (MiB)' }).fill('2048')
      await section.getByLabel('Status', { exact: true }).selectOption('inactive')
      await save(page, address)
      await expect(section).toContainText('Smoke Sections')
      let saved = await readMailbox(page, address)
      expect(saved).toMatchObject({ displayName: 'Smoke Sections', quota: 2 * GIB })
      expect(saved.status).toBe('inactive')

      // Active again, a generated password and POP3 off.
      await editMailboxSection(page)
      await section.getByLabel('Status', { exact: true }).selectOption('active')
      await section.locator('[data-generate]').click()
      const password = await section.getByLabel('Password', { exact: true }).inputValue()
      expect(password.length).toBeGreaterThanOrEqual(16)
      const protocols = section.getByRole('listbox', { name: PROTOCOLS })
      const selected = await protocols.evaluate((element) =>
        [...(element as HTMLSelectElement).selectedOptions].map((option) => option.value),
      )
      await protocols.selectOption(selected.filter((value) => value !== 'pop3'))
      await save(page, address)
      saved = await readMailbox(page, address)
      expect(saved.status).toBe('active')
      expect(saved.protocolAccess).toMatchObject({ pop3: false, imap: true })
      expect(saved.passwordChangedAt).not.toBe(created.passwordChangedAt)

      // After a reload the page shows the saved values, and the password field is empty again.
      await page.reload()
      await expect(section).toContainText('Smoke Sections')
      await expect(section).not.toContainText('POP3')
      await editMailboxSection(page)
      await expect(section.getByLabel('Password', { exact: true })).toHaveValue('')
      await expect(page.locator('body')).not.toContainText(password)
    } finally {
      await deleteMailbox(page, address)
    }
  })

  test('@read-only reseller sees the mailbox protocols read-only with "Prohibited by ACL"', async ({
    page,
  }) => {
    await signIn(page, 'reseller')
    await page.goto(`mailboxes/alice@${SMOKE_DOMAIN}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Edit mailbox' })).toBeVisible()
    await editMailboxSection(page)
    const locked = page.locator('[data-locked="section-mailbox-protocols"]')
    await expect(locked).toContainText(PROTOCOLS)
    await expect(locked).toContainText('Prohibited by ACL')
    await expect(page.getByRole('listbox', { name: PROTOCOLS })).toHaveCount(0)
    // Nothing is saved: alice stays as seeded.
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('button', { name: 'Edit Edit mailbox', exact: true })).toBeVisible()
  })
})
