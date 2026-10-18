// Per-test environment for Vitest (research R23): MSW with the contract-validated mock API
// (T027), and a fresh Pinia and QueryClient per test. The app's i18n instance is added by T055.
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
