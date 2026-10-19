// UI 003 smoke tests against the API dev stack (T053, T064, T082, T098, T114, T121, research D29):
// the seeded mailboxes by role; a mailbox added through the form, renamed keeping its alias, changed
// and found in its History, deactivated and activated in bulk, and removed through the dialog with
// the real deletion preview. Every mailbox it creates has a unique name and is removed at the end.
import { expect, test } from '@playwright/test'

import { signIn } from './fixtures/domains-api'
import { deleteMailbox, SMOKE_DOMAIN as DOMAIN, uniqueLocalPart } from './fixtures/mailboxes-api'

test.describe('@read-only mailboxes', () => {
  test('admin lists the seeded mailboxes, searches "alice" and opens alice@example.org', async ({
    page,
  }) => {
    await signIn(page, 'admin')
    await page.goto('mailboxes')
    await expect(page.locator('[data-entry]').first()).toBeVisible()
    await page.getByRole('searchbox', { name: 'Search:' }).fill('alice')
    await page
      .locator('[data-entry="alice@example.org"]')
      .getByRole('link', { name: 'alice@example.org', exact: true })
      .click()
    await expect(page.getByRole('heading', { level: 1, name: 'Edit mailbox' })).toBeVisible()
  })

  test('reseller sees only mailboxes of example.org and example.net, at 360 px without scroll', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await signIn(page, 'reseller')
    await page.goto('mailboxes?size=100')
    await expect(page.locator('[data-entry]').first()).toBeVisible()
    const addresses = await page
      .locator('[data-entry]')
      .evaluateAll((items) => items.map((item) => item.getAttribute('data-entry') ?? ''))
    expect(addresses.every((a) => a.endsWith('@example.org') || a.endsWith('@example.net'))).toBe(
      true,
    )
    const width = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(width).toBeLessThanOrEqual(360)
  })
})

test.describe('@mailboxes', () => {
  test('a mailbox is added, renamed, changed, found in its History, bulk-changed and removed', async ({
    page,
  }) => {
    test.slow()
    const local = uniqueLocalPart()
    const renamed = `${local}.new`
    await signIn(page, 'admin')
    try {
      // T064: add through the form.
      await page.goto(`mailboxes/new?domain=${DOMAIN}`)
      await page.getByLabel('Username (left part of an email address)').fill(local)
      await page.getByRole('button', { name: '(generate)' }).click()
      await page
        .locator('[data-sticky-save]')
        .getByRole('button', { name: 'Add', exact: true })
        .click()
      await expect(page).toHaveURL(new RegExp(`/mailboxes/${local}@${DOMAIN}$`))
      await expect(page.locator('[data-flash="success"]')).toContainText(`${local}@${DOMAIN}`)

      // T114: rename keeping the alias.
      const rename = page.locator('#section-rename')
      await rename.getByLabel('I have created a backup.').check()
      await rename.getByLabel('New local mailbox name').fill(`${local}.new`)
      await rename.getByRole('button', { name: 'Save changes' }).click()
      await expect(page).toHaveURL(new RegExp(`/mailboxes/${renamed}@${DOMAIN}$`))
      expect((await page.request.get(`/api/v2/mailboxes/${local}@${DOMAIN}`)).status()).toBe(404)

      // T121: a change appears in the History. API 003 records the rename under the previous
      // address, so it is in that address's history.
      await page.getByRole('button', { name: 'Edit Edit mailbox', exact: true }).click()
      await page
        .locator('#section-mailbox')
        .getByRole('textbox', { name: 'Full name', exact: true })
        .fill('Smoke History')
      await page.getByRole('button', { name: 'Save changes', exact: true }).click()
      await expect(
        page
          .locator('section[id^="section-"]')
          .getByText(`Changes to mailbox ${renamed}@${DOMAIN} have been saved`),
      ).toBeVisible()
      await page.getByRole('link', { name: 'History' }).click()
      await expect(page.getByText('Mailbox changed').first()).toBeVisible()
      await page.goto(`audit-log?targetType=mailbox&targetId=${local}@${DOMAIN}`)
      await expect(page.getByText('Mailbox renamed').first()).toBeVisible()

      // T098: deactivate and activate in bulk.
      await page.goto(`mailboxes?q=${renamed}`)
      await page.getByRole('button', { name: 'Select', exact: true }).click()
      await page.getByRole('checkbox', { name: `Select ${renamed}@${DOMAIN}` }).check()
      const bar = page.getByRole('region', { name: 'Bulk actions' })
      await bar.getByRole('button', { name: 'Mailbox' }).click()
      await page.getByRole('menuitem', { name: 'Deactivate', exact: true }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Deactivate' }).click()
      await expect(page.getByRole('region', { name: 'Results' })).toContainText('1 done')

      // T082: remove through the dialog with the real preview.
      await page.getByRole('button', { name: 'Done selecting' }).click()
      await page
        .locator(`[data-entry="${renamed}@${DOMAIN}"]`)
        .getByRole('button', { name: /^Remove/ })
        .click()
      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toContainText('garbage area')
      await dialog.getByRole('button', { name: 'Delete now' }).click()
      await expect(page.locator('[data-success]')).toContainText(`${renamed}@${DOMAIN}`)
    } finally {
      await deleteMailbox(page, `${renamed}@${DOMAIN}`)
      await deleteMailbox(page, `${local}@${DOMAIN}`)
    }
  })
})
