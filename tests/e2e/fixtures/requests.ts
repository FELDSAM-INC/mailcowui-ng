// UI 006 (T027, research R9, SC-002, FR-083): a guard against message data causing requests or
// running code. It records every request of the test's pages and lists those outside the app's own
// paths (`/ng/`, `/api/v2/` and mailcow's `/lang/` files on the app's origin; `data:` and `blob:`
// URLs stay inside the browser). An init script installs a `window.__xss` canary and turns
// `alert`, `confirm` and `prompt` into it, so that any script from a message trips it. The fixture
// `guardRequests` (tests/e2e/fixtures/test.ts) is opt-in: a test that names it fails on a request
// outside those paths or a tripped canary.
import type { BrowserContext, Page } from '@playwright/test'

declare global {
  interface Window {
    __xss?: unknown
  }
}

const OWN_PATHS = ['/ng/', '/api/v2/', '/lang/']

export interface RequestGuard {
  /** Every URL the pages of the context requested, in order. */
  list(): string[]
  /** The requested URLs outside the app's own paths. */
  outside(): string[]
  /** Whether a script set the canary in the page. */
  canaryTripped(page: Page): Promise<boolean>
}

export async function attachRequestGuard(
  context: BrowserContext,
  appUrl: string,
): Promise<RequestGuard> {
  const origin = new URL(appUrl).origin
  const urls: string[] = []
  context.on('request', (request) => urls.push(request.url()))
  await context.addInitScript(() => {
    const trip = () => {
      window.__xss = 1
    }
    window.alert = trip
    window.confirm = () => {
      trip()
      return false
    }
    window.prompt = () => {
      trip()
      return null
    }
  })
  const isOwn = (url: string) => {
    if (url.startsWith('data:') || url.startsWith('blob:')) return true
    try {
      const parsed = new URL(url)
      return parsed.origin === origin && OWN_PATHS.some((path) => parsed.pathname.startsWith(path))
    } catch {
      return false
    }
  }
  return {
    list: () => [...urls],
    outside: () => urls.filter((url) => !isOwn(url)),
    canaryTripped: async (page) =>
      page.isClosed() ? false : await page.evaluate(() => window.__xss !== undefined),
  }
}
