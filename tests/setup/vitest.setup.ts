// Per-test environment for Vitest (research R23): MSW with the contract-validated mock API
// (T027), and a fresh Pinia, QueryClient and en-gb i18n instance per test (tests/unit/support/mount.ts),
// with mailcow's en-gb strings loaded from the mock's `/lang/` (the bundled upstream snapshot).
import { setActivePinia } from 'pinia'
import { afterAll, afterEach, beforeEach } from 'vitest'

import { clearCsrfToken } from '@/api'
import { loadLegacy } from '@/i18n'

import { mockState, resetMockState, server } from '../mocks/node'
import { resetTestPlugins } from '../unit/support/mount'

// Listen before test modules are imported, so clients created at import time are intercepted.
server.listen({ onUnhandledFrame: 'error' })

beforeEach(async () => {
  const { pinia } = resetTestPlugins()
  setActivePinia(pinia)
  await loadLegacy('en-gb')
})

afterEach(() => {
  const violations = [...mockState().violations.list()]
  server.resetHandlers()
  resetMockState()
  // Each test's scenario starts a new anonymous session with its own token.
  clearCsrfToken()
  document.body.innerHTML = ''
  document.documentElement.className = ''
  document.documentElement.removeAttribute('style')
  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {
    // A test replaced the storage with a throwing stub.
  }
  if (violations.length > 0) {
    throw new Error(
      `Mock contract violations:\n${violations
        .map((v) => `  ${v.method} ${v.path}: ${v.messages.join('; ')}`)
        .join('\n')}`,
    )
  }
})

afterAll(() => {
  server.close()
})
