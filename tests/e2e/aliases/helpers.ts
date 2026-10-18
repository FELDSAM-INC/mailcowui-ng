// Helpers of the UI 004 end-to-end tests: the layout by width, list entries by ID or address, and
// waiting for a list to settle.
import { expect, type Locator, type Page } from '@playwright/test'

/** Cards below md (768 px), a table from md up. */
export const isNarrow = (page: Page) => (page.viewportSize()?.width ?? 0) < 768

export function entries(page: Page): Locator {
  return page.locator('[data-entry]')
}

export function entry(page: Page, id: string | number): Locator {
  return page.locator(`[data-entry="${id}"]`)
}

export async function entryIds(page: Page): Promise<string[]> {
  await expect(entries(page).first()).toBeVisible()
  return entries(page).evaluateAll((items) =>
    items.map((item) => item.getAttribute('data-entry') ?? ''),
  )
}

/** Waits until the list has settled: results, an empty state or an error, but no loading state. */
export async function listReady(page: Page): Promise<void> {
  await expect(page.locator('[data-list-state]')).toHaveAttribute(
    'data-list-state',
    /^(?!loading$)/,
  )
}

/** Opens the filter panel when it is collapsed. */
export async function openFilters(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: /^Filters/ })
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
}

/** Chooses an option of a DomainPicker or MailboxSearchPicker by its visible text. */
export async function pick(page: Page, label: string | RegExp, search: string, option: string) {
  const field = page.getByRole('combobox', { name: label, exact: true })
  await field.click()
  await field.fill(search)
  await page
    .getByRole('option', { name: new RegExp(option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
    .first()
    .click()
}
