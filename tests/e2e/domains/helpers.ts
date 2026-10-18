// Helpers of the UI 002 end-to-end tests: the list layout by width, entry names in order, and
// waiting for the list to settle.
import { expect, type Locator, type Page } from '@playwright/test'

/** Cards below md (768 px), a table from md up (research D8). */
export const isNarrow = (page: Page) => (page.viewportSize()?.width ?? 0) < 768
export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024

/** The entries of the domain or template list, in order (cards or table rows). */
export function entries(page: Page): Locator {
  return page.locator('[data-entry]')
}

export async function entryNames(page: Page): Promise<string[]> {
  await expect(entries(page).first()).toBeVisible()
  return entries(page).evaluateAll((items) =>
    items.map((item) => item.getAttribute('data-entry') ?? ''),
  )
}

export function entry(page: Page, name: string): Locator {
  return page.locator(`[data-entry="${name}"]`)
}

/** Waits until the list has settled: results, an empty state or an error, but no loading state. */
export async function listReady(page: Page): Promise<void> {
  await expect(page.locator('[data-list-state]')).toHaveAttribute(
    'data-list-state',
    /^(?!loading$)/,
  )
}

/** The total of the result count ("Domains found: 60"). */
export async function resultCount(page: Page): Promise<string> {
  return (await page.locator('[data-result-count]').textContent())?.trim() ?? ''
}

/** Opens the filter panel when it is collapsed. */
export async function openFilters(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: /^Filters/ })
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
}
