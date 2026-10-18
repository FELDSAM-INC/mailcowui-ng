// Helpers of the UI 008 end-to-end tests: the layout by width, list entries and their order,
// waiting for the list to settle, and the requests the mock recorded.
import { expect, type Locator, type Page } from '@playwright/test'

import type { MockApi } from '../fixtures/mock-api'

/** Cards below md (768 px), a table from md up. */
export const isNarrow = (page: Page) => (page.viewportSize()?.width ?? 0) < 768

export function entries(page: Page): Locator {
  return page.locator('[data-entry]')
}

export function entry(page: Page, id: number): Locator {
  return page.locator(`[data-entry="${id}"]`)
}

export async function entryIds(page: Page): Promise<number[]> {
  await expect(entries(page).first()).toBeVisible()
  return entries(page).evaluateAll((items) =>
    items.map((item) => Number(item.getAttribute('data-entry'))),
  )
}

/** Waits until the list shows results, an empty state or an error, but no loading state. */
export async function listReady(page: Page): Promise<void> {
  await expect(page.locator('[data-list-state]')).toHaveAttribute(
    'data-list-state',
    /^(?!loading$)/,
  )
}

export async function openFilters(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: /^Filters/ })
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
}

/** The requests of one operation the mock received. */
export async function requestsOf(mockApi: MockApi, operationId: string) {
  return (await mockApi.requests()).filter((request) => request.operationId === operationId)
}

/** Opens the row menu of a job ("Actions for …") and chooses an item. */
export async function rowAction(page: Page, id: number, item: string): Promise<void> {
  await entry(page, id)
    .getByRole('button', { name: /^Actions for / })
    .click()
  await page.getByRole('menuitem', { name: item }).click()
}
