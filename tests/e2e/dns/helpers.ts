// Helpers of the UI 010 end-to-end tests: the list layout by width, entry names in order, the list
// settling, and the filter panel.
import { expect, type Locator, type Page } from '@playwright/test'

/** The first page load of a worker on a loaded machine (lazy chunks, the language files). */
export const FIRST_LOAD = 20_000

/** Cards below md (768 px), a table from md up. */
export const isNarrow = (page: Page) => (page.viewportSize()?.width ?? 0) < 768

export function entries(page: Page): Locator {
  return page.locator('[data-entry]')
}

export function entry(page: Page, name: string): Locator {
  return page.locator(`[data-entry="${name}"]`)
}

export async function entryNames(page: Page): Promise<string[]> {
  await expect(entries(page).first()).toBeVisible()
  return entries(page).evaluateAll((items) =>
    items.map((item) => item.getAttribute('data-entry') ?? ''),
  )
}

/** Waits until the list has settled: results, an empty state or an error. */
export async function listReady(page: Page): Promise<void> {
  await expect(page.locator('[data-list-state]')).toHaveAttribute(
    'data-list-state',
    /^(?!loading$)/,
    { timeout: FIRST_LOAD },
  )
}

export async function resultCount(page: Page): Promise<string> {
  return (await page.locator('[data-result-count]').textContent())?.trim() ?? ''
}

export async function openFilters(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: /^Filters/ })
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
}

/** Grants clipboard access on Chromium, so copies can be read back. */
export async function allowClipboard(page: Page, browserName: string): Promise<boolean> {
  if (browserName !== 'chromium') return false
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  return true
}

export const clipboardText = (page: Page) => page.evaluate(() => navigator.clipboard.readText())
