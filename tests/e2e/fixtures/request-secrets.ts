import type { Page } from '@playwright/test'

interface SecretRequest {
  method: string
  path: string
  marker: number
}

/** Streaming fetch bodies are not exposed by Playwright's request.postData(). Observe a clone
 * at the browser transport boundary, retaining only where each synthetic marker was sent. */
export async function observeRequestSecrets(page: Page, markers: string[]) {
  await page.addInitScript((values) => {
    const calls: SecretRequest[] = []
    Object.defineProperty(window, '__testSecretRequests', { value: calls, configurable: true })
    const original = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const copy = new Request(input instanceof Request ? input.clone() : input, init)
      if (copy.method !== 'GET' && copy.method !== 'HEAD') {
        const body = await copy.text()
        for (const [marker, value] of values.entries()) {
          if (body.includes(value)) {
            calls.push({ method: copy.method, path: new URL(copy.url).pathname, marker })
          }
        }
      }
      return original(input, init)
    }
  }, markers)
  return () =>
    page.evaluate(
      () => (window as unknown as { __testSecretRequests: SecretRequest[] }).__testSecretRequests,
    )
}
