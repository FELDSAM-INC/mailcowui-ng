// A fake identity provider for the single sign-on end-to-end tests (UI 012 T041, research R24).
// The mock API's start answers an authorization address on https://idp.example.test, which this
// fixture routes, so the round trip runs on every browser project without a real provider. The app
// only navigates there; every request the fixture sees is recorded with its resource type, so tests
// can prove that the app never calls the provider itself (FR-080).
import type { BrowserContext, Route } from '@playwright/test'

export const PROVIDER_ORIGIN = 'https://idp.example.test'

export type ProviderAnswer =
  | { kind: 'code' }
  | { kind: 'codeOnly' }
  | { kind: 'error'; error: string; description?: string; withoutState?: boolean }

export interface FakeProviderOptions {
  /** `redirect` returns to the app at once; `page` shows "Approve" and "Cancel" links first. */
  mode?: 'redirect' | 'page'
  answer?: ProviderAnswer
}

export interface ProviderRequest {
  url: string
  resourceType: string
}

export interface FakeProvider {
  requests(): ProviderRequest[]
  /** The `state` values of the authorization requests, in order. */
  states(): string[]
  /** The codes returned so far, in order (`mock-code-<n>`). */
  codes(): string[]
  /** Changes how the next authorization requests are answered. */
  answer(next: ProviderAnswer): void
}

function returnUrl(authorization: URL, answer: ProviderAnswer, code: string): string {
  const target = new URL(authorization.searchParams.get('redirect_uri') ?? '/')
  const state = authorization.searchParams.get('state') ?? ''
  switch (answer.kind) {
    case 'code':
      target.searchParams.set('code', code)
      target.searchParams.set('state', state)
      break
    case 'codeOnly':
      target.searchParams.set('code', code)
      break
    case 'error':
      target.searchParams.set('error', answer.error)
      if (answer.description) target.searchParams.set('error_description', answer.description)
      if (!answer.withoutState) target.searchParams.set('state', state)
      break
  }
  return target.toString()
}

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

export async function fakeProvider(
  context: BrowserContext,
  options: FakeProviderOptions = {},
): Promise<FakeProvider> {
  const requests: ProviderRequest[] = []
  const states: string[] = []
  const codes: string[] = []
  let answer: ProviderAnswer = options.answer ?? { kind: 'code' }
  let counter = 0

  await context.route(`${PROVIDER_ORIGIN}/**`, async (route: Route) => {
    const request = route.request()
    requests.push({ url: request.url(), resourceType: request.resourceType() })
    const url = new URL(request.url())
    if (url.pathname === '/auth') {
      states.push(url.searchParams.get('state') ?? '')
      const code = `mock-code-${++counter}`
      codes.push(code)
      const approve = returnUrl(url, answer, code)
      if (options.mode === 'page') {
        const cancel = returnUrl(url, { kind: 'error', error: 'access_denied' }, code)
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: `<!doctype html><html lang="en"><head><title>Example IdP</title></head><body><h1>Example IdP</h1><a href="${escape(approve)}">Approve</a> <a href="${escape(cancel)}">Cancel</a></body></html>`,
        })
        return
      }
      // WebKit cannot fulfil a route with a redirect status, so the page replaces itself at once
      // (no history entry), as a provider that redirects does.
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `<!doctype html><html lang="en"><head><title>Example IdP</title><script>location.replace(${JSON.stringify(approve)})</script></head><body></body></html>`,
      })
      return
    }
    await route.fulfill({ status: 404, body: 'not found' })
  })

  return {
    requests: () => [...requests],
    states: () => [...states],
    codes: () => [...codes],
    answer(next) {
      answer = next
    },
  }
}
