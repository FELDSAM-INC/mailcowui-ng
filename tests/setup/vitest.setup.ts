// Per-test environment for Vitest (research R23): MSW with the contract-validated mock API
// (T027), and a fresh Pinia, QueryClient and en-gb i18n instance per test (tests/unit/support/mount.ts).
import { setActivePinia } from 'pinia'
import { afterAll, afterEach, beforeEach } from 'vitest'

import { mockState, resetMockState, server } from '../mocks/node'
import { resetTestPlugins } from '../unit/support/mount'

// Listen before test modules are imported, so clients created at import time are intercepted.
server.listen({ onUnhandledFrame: 'error' })

beforeEach(() => {
  const { pinia } = resetTestPlugins()
  setActivePinia(pinia)
})

afterEach(() => {
  const violations = [...mockState().violations.list()]
  server.resetHandlers()
  resetMockState()
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
