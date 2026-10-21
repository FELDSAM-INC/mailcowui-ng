import { expect, type Locator, type Page } from '@playwright/test'

/** Finds an action in a row's menu or in its direct controls, including mobile cards. */
export async function rowAction(page: Page, row: Locator, name: string | RegExp): Promise<Locator> {
  await expect(row).toBeVisible()
  const trigger = row.locator('[data-row-action-trigger]')
  const options = { name, exact: typeof name === 'string' }
  if (await trigger.count()) {
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click()
    return page.getByRole('menuitem', options)
  }
  return row.getByRole('button', options).or(row.getByRole('link', options))
}

export async function clickRowAction(
  page: Page,
  row: Locator,
  name: string | RegExp,
): Promise<void> {
  await (await rowAction(page, row, name)).click()
}
