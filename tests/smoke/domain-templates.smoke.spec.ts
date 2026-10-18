// UI 002 US6 smoke test (T082, research D29): a smoke template is added with the classic add form,
// its alias limit changed and it is removed; the Default template keeps a read-only name and has no
// Remove action.
import { expect, test } from '@playwright/test'

import { deleteTemplate, signIn, uniqueName } from './fixtures/domains-api'

test.describe('@domain-templates', () => {
  test('admin adds, changes and removes a template', async ({ page }) => {
    const name = uniqueName('Smoke')
    await signIn(page, 'admin')
    let id: number | null = null
    try {
      await page.goto('domain-templates/new')
      await page.getByRole('textbox', { name: 'Template (required)' }).fill(name)
      await page.getByRole('textbox', { name: 'Max. possible mailboxes', exact: true }).fill('5')
      await page
        .locator('[data-sticky-save]')
        .getByRole('button', { name: 'Add', exact: true })
        .click()
      await expect(page).toHaveURL(/\/ng\/domain-templates$/)
      await page.getByRole('searchbox', { name: 'Search:' }).fill(name)
      const row = page.locator('[data-entry]').filter({ hasText: name })
      await expect(row).toHaveCount(1)
      id = Number(await row.getAttribute('data-entry'))
      await row.getByRole('link', { name: `Edit: ${name}` }).click()
      await page.getByRole('textbox', { name: 'Max. aliases', exact: true }).fill('25')
      await page.getByRole('button', { name: 'Save changes' }).click()
      await expect(page.locator('[data-live="polite"]')).toContainText(name)
      await page.goto(`domain-templates?q=${encodeURIComponent(name)}`)
      await page
        .locator(`[data-entry="${id}"]`)
        .getByRole('button', { name: `Remove: ${name}` })
        .click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete now' }).click()
      await expect(page.locator(`[data-entry="${id}"]`)).toHaveCount(0)
    } finally {
      if (id !== null) await deleteTemplate(page, id)
    }
  })

  test('the Default template has a read-only name and no Remove action', async ({ page }) => {
    await signIn(page, 'admin')
    await page.goto('domain-templates?q=default')
    const row = page.locator('[data-entry]').filter({ has: page.locator('[data-default-badge]') })
    await expect(row.getByRole('button', { name: /^Remove/ })).toHaveCount(0)
    await row.getByRole('link', { name: /^Edit/ }).click()
    await expect(page.getByRole('textbox', { name: 'Template (required)' })).toHaveAttribute(
      'readonly',
      '',
    )
  })
})
