// The end-to-end `test` (research R24). Every test automatically gets its own mock scenario
// (`anonymous-default` until it calls `mockApi.use`) and fails on any mock contract violation or
// CSP violation. `expectAccessible`, the layout checks and the WebAuthn tools are fixtures too.
import { test as base, expect, type Page } from '@playwright/test'

import { expectAccessible as axeCheck, type AccessibleOptions } from './a11y'
import { attachCspRecorder, type CspRecorder } from './csp'
import { expectNoHorizontalScroll, expectTouchTargets } from './layout'
import { createMockApi, type MockApi } from './mock-api'
import { fakeProvider, type FakeProvider, type FakeProviderOptions } from './provider'
import { createWebAuthnTools, type WebAuthnTools } from './webauthn'

interface Fixtures {
  mockApi: MockApi
  cspViolations: CspRecorder
  webauthn: WebAuthnTools
  expectAccessible: (page?: Page, options?: AccessibleOptions) => Promise<void>
  expectNoHorizontalScroll: (page?: Page, options?: { widths?: number[] }) => Promise<void>
  expectTouchTargets: (page?: Page) => Promise<void>
  /** UI 012: routes the fake identity provider for this test's browser context. */
  fakeProvider: (options?: FakeProviderOptions) => Promise<FakeProvider>
}

export const test = base.extend<Fixtures>({
  mockApi: [
    async ({ context, baseURL }, use) => {
      const api = createMockApi(context, baseURL ?? 'http://localhost:4173/ng/')
      await api.use('anonymous-default')
      await use(api)
      expect(await api.violations(), 'mock contract violations').toEqual([])
    },
    { auto: true },
  ],
  cspViolations: [
    async ({ context }, use) => {
      const recorder = await attachCspRecorder(context)
      await use(recorder)
      expect(recorder.list(), 'Content-Security-Policy violations').toEqual([])
    },
    { auto: true },
  ],
  webauthn: async ({ page, context }, use) => {
    await use(createWebAuthnTools(page, context))
  },
  expectAccessible: async ({ page }, use) => {
    await use((target = page, options) => axeCheck(target, options))
  },
  expectNoHorizontalScroll: async ({ page }, use) => {
    await use((target = page, options) => expectNoHorizontalScroll(target, options))
  },
  expectTouchTargets: async ({ page }, use) => {
    await use((target = page) => expectTouchTargets(target))
  },
  fakeProvider: async ({ context }, use) => {
    await use((options) => fakeProvider(context, options))
  },
})

export { expect }
