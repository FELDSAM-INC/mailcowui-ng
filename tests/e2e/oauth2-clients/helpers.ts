// Helpers of the UI 012 OAuth2 end-to-end tests: the list layout by width, the entries, waiting
// for the list to settle, the clipboard stub and the client IDs of the scenarios.
import { expect, type Locator, type Page } from '@playwright/test'

export { fixedClientId } from '../../mocks/scenarios/oauth2-clients'

/** Cards below md (768 px), a table from md up. */
export const isNarrow = (page: Page) => (page.viewportSize()?.width ?? 0) < 768

export function entry(page: Page, id: number | string): Locator {
  return page.locator(`[data-entry="${id}"]`)
}

export async function entryIds(page: Page): Promise<string[]> {
  await expect(page.locator('[data-entry]').first()).toBeVisible()
  return page
    .locator('[data-entry]')
    .evaluateAll((items) => items.map((item) => item.getAttribute('data-entry') ?? ''))
}

/** Waits until the list has settled: results, an empty state or an error, but no loading state. */
export async function listReady(page: Page): Promise<void> {
  await expect(page.locator('[data-list-state]')).toHaveAttribute(
    'data-list-state',
    /^(?!loading$)/,
  )
}

/** navigator.clipboard as a stub that records the copied text, or refuses. */
export async function stubClipboard(page: Page, refuse = false): Promise<void> {
  await page.addInitScript((refuseCopy: boolean) => {
    const record = window as unknown as { __copied?: string }
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          if (refuseCopy) return Promise.reject(new DOMException('denied', 'NotAllowedError'))
          record.__copied = text
          return Promise.resolve()
        },
      },
    })
  }, refuse)
}
