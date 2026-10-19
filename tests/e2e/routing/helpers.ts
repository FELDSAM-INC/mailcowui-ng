// Helpers of the UI 009 end-to-end tests: the list layout by width, entries by their ID, waiting
// for the list to settle, and the filter panel.
import { expect, type Locator, type Page } from '@playwright/test'

/** Cards below md (768 px), a table from md up (research R4). */
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

/** Opens the filter panel when it is collapsed (below md). */
export async function openFilters(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: 'Filters and sorting' })
  if (!(await toggle.isVisible())) return
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
}

/** Types into the list's search field and waits for the list to follow. */
export async function search(page: Page, text: string): Promise<void> {
  await page.getByRole('searchbox', { name: 'Search:' }).fill(text)
  await expect(page).toHaveURL(new RegExp(`[?&]q=${encodeURIComponent(text)}`))
  await listReady(page)
}

/** The polite live region, where saves and results are announced. */
export const polite = (page: Page) => page.locator('[data-live="polite"]')
