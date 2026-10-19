// Page visibility for the live-update tests (UI 011 research R21, T015): makes
// `document.visibilityState` and `document.hidden` controllable and dispatches `visibilitychange`,
// so a test hides and shows the page deterministically (a background tab never throttles here).
import type { Page } from '@playwright/test'

export async function setPageVisibility(page: Page, state: 'visible' | 'hidden'): Promise<void> {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', { value, configurable: true })
    Object.defineProperty(document, 'hidden', { value: value === 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  }, state)
}
