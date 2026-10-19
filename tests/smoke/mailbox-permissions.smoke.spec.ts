// UI 003 US5 smoke test against the API dev stack (T089, research D29): on a mailbox created
// through the API, `admin` allows sync jobs in the ACL section, adds two tags in the "Mailbox"
// section, adds a custom attribute, and removes one tag. The page then shows the saved values
// after a reload. The mailbox is removed at the end.
import { expect, test, type Page } from '@playwright/test'

import { signIn } from './fixtures/domains-api'
import {
  createMailbox,
  deleteMailbox,
  readMailbox,
  SMOKE_DOMAIN,
  uniqueLocalPart,
} from './fixtures/mailboxes-api'

async function edit(page: Page, section: string) {
  await page.getByRole('button', { name: `Edit ${section}`, exact: true }).click()
  await expect(page.getByRole('heading', { level: 2, name: section })).toBeFocused()
}

/** Saves the open section; the success stays in the section that saved it. */
async function save(page: Page, section: string, address: string) {
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(
    page.locator(`#section-${section}`).getByText(`Changes to mailbox ${address} have been saved`),
  ).toBeVisible()
}

test.describe('@mailboxes mailbox permissions', () => {
  test('admin allows sync jobs, adds two tags and an attribute, removes one tag, and sees the saved values', async ({
    page,
  }) => {
    test.slow()
    const address = `${uniqueLocalPart()}@${SMOKE_DOMAIN}`
    await signIn(page, 'admin')
    try {
      const created = await createMailbox(page, address.split('@')[0]!, {
        userPermissions: { syncjobs: false },
      })
      expect(created.userPermissions.syncjobs).toBe(false)
      await page.goto(`mailboxes/${address}`)
      await expect(page.getByRole('heading', { level: 1, name: 'Edit mailbox' })).toBeVisible()

      // ACL: sync jobs on.
      await edit(page, 'ACL (Permission)')
      const acl = page.getByLabel('ACL', { exact: true })
      const permissions = await acl.evaluate((element) =>
        [...(element as HTMLSelectElement).selectedOptions].map((option) => option.value),
      )
      await acl.selectOption([...permissions, 'syncjobs'])
      await save(page, 'acl', address)

      // Two tags in the "Mailbox" section.
      const mailbox = page.locator('#section-mailbox')
      await edit(page, 'Edit mailbox')
      // With suggestions of the tags in use, the input is a combobox.
      const tags = mailbox.getByRole('combobox', { name: 'Tags', exact: true })
      await tags.fill('smoke-one')
      await tags.press('Enter')
      await tags.fill('smoke-two')
      await tags.press('Enter')
      await save(page, 'mailbox', address)

      // A custom attribute.
      await edit(page, 'Custom attributes')
      const attributes = page.locator('#section-attributes')
      await attributes.getByRole('button', { name: 'Add row' }).click()
      await attributes.getByLabel('Attribute 1').fill('department')
      await attributes.getByLabel('Value 1').fill('Sales')
      await save(page, 'attributes', address)

      // One tag removed.
      await edit(page, 'Edit mailbox')
      await mailbox.getByRole('button', { name: 'Remove tag smoke-one' }).click()
      await save(page, 'mailbox', address)

      const saved = await readMailbox(page, address)
      expect(saved.userPermissions.syncjobs).toBe(true)
      expect(saved.tags).toEqual(['smoke-two'])
      expect(saved.customAttributes).toEqual({ department: 'Sales' })

      await page.reload()
      await expect(page.locator('#section-acl')).toContainText('Sync jobs')
      await expect(mailbox).toContainText('smoke-two')
      await expect(mailbox).not.toContainText('smoke-one')
      await expect(page.locator('#section-attributes')).toContainText('department')
      await expect(page.locator('#section-attributes')).toContainText('Sales')
    } finally {
      await deleteMailbox(page, address)
    }
  })
})
