import { expect, type Locator, type Page } from '@playwright/test'

export async function selectValues(page: Page, trigger: Locator, values: string[]) {
  await trigger.click()
  const options = page.getByRole('menuitemcheckbox')
  for (const option of await options.all()) {
    const value = await option.getAttribute('data-multiselect-option')
    const wanted = value !== null && values.includes(value)
    if ((await option.getAttribute('aria-checked')) !== String(wanted)) await option.click()
  }
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
}
