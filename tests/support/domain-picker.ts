import { expect, type Page } from '@playwright/test'

/** Pick a domain through the account form's responsive shared picker. */
export async function pickDomain(page: Page, fieldId: string, name: string): Promise<void> {
  const field = page.locator(`#${fieldId}`)
  await expect(field).toBeVisible()
  if ((await field.getAttribute('aria-haspopup')) === 'dialog') {
    await field.click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('[data-picker-search]').fill(name)
    await dialog.getByRole('checkbox', { name, exact: true }).check()
    await dialog.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(dialog).toHaveCount(0)
  } else {
    await field.fill(name)
    await page.getByRole('option', { name, exact: true }).click()
  }
}
