// UI 003 US7 smoke test against the API dev stack (T105, research D29): `admin` adds a smoke
// template with the classic add form, changes its quota, sees that Default has no Remove action and
// a read-only name, and removes the new template; `reseller` reads the list without controls.
import { expect, test, type Page } from '@playwright/test'

import { signIn, uniqueName } from './fixtures/domains-api'

/** Removes a template left over by a failed run, through the real API. */
async function deleteMailboxTemplate(page: Page, id: number): Promise<void> {
  const read = await page.request.get(`/api/v2/mailbox-templates/${id}`)
  if (read.status() === 404) return
  const { etag } = ((await read.json()) as { data: { etag: string } }).data
  const token = await page.request.get('/api/v2/csrf-token')
  const { data } = (await token.json()) as { data: { token: string } }
  const response = await page.request.delete(`/api/v2/mailbox-templates/${id}`, {
    headers: { 'X-CSRF-Token': data.token, 'If-Match': etag },
  })
  expect([204, 404], `delete mailbox template ${id}`).toContain(response.status())
}

test.describe('@mailbox-templates', () => {
  test('admin adds a template, changes its quota and removes it; Default cannot be removed', async ({
    page,
  }) => {
    const name = uniqueName('smoke')
    await signIn(page, 'admin')
    let id: number | null = null
    try {
      await page.goto('mailbox-templates/new')
      await page.getByRole('textbox', { name: 'Template (required)' }).fill(name)
      await page
        .locator('[data-sticky-save]')
        .getByRole('button', { name: 'Add', exact: true })
        .click()
      await expect(page).toHaveURL(/\/ng\/mailbox-templates$/)
      await page.getByRole('searchbox', { name: 'Search:' }).fill(name)
      const row = page.locator('[data-entry]').filter({ hasText: name })
      await expect(row).toHaveCount(1)
      id = Number(await row.getAttribute('data-entry'))
      await row.getByRole('link', { name: `Edit: ${name}` }).click()
      await page.getByRole('textbox', { name: 'Quota (MiB)', exact: true }).fill('512')
      await page.getByRole('button', { name: 'Save changes' }).click()
      await expect(page.locator('[data-live="polite"]')).toContainText(name)

      await page.goto('mailbox-templates?q=default')
      const fallback = page
        .locator('[data-entry]')
        .filter({ has: page.locator('[data-default-badge]') })
      await expect(fallback.getByRole('button', { name: /^Remove/ })).toHaveCount(0)
      await fallback.getByRole('link', { name: /^Edit/ }).click()
      await expect(page.getByRole('textbox', { name: 'Template (required)' })).toHaveAttribute(
        'readonly',
        '',
      )

      await page.goto(`mailbox-templates?q=${encodeURIComponent(name)}`)
      await page
        .locator(`[data-entry="${id}"]`)
        .getByRole('button', { name: `Remove: ${name}` })
        .click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
      await expect(page.locator(`[data-entry="${id}"]`)).toHaveCount(0)
    } finally {
      if (id !== null) await deleteMailboxTemplate(page, id)
    }
  })

  test('reseller reads the templates without controls', async ({ page }) => {
    await signIn(page, 'reseller')
    await page.goto('mailbox-templates')
    await expect(page.locator('[data-entry]').first()).toBeVisible()
    await expect(page.locator('[data-default-badge]').first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Add Template' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Remove/ })).toHaveCount(0)
  })
})
