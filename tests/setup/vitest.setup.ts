// Per-test environment for Vitest (research R23). Later foundation tasks add the MSW server
// (T027) and the real i18n instance (T055).
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach } from 'vitest'

import { resetTestPlugins } from '../unit/support/mount'

beforeEach(() => {
  const { pinia } = resetTestPlugins()
  setActivePinia(pinia)
})

afterEach(() => {
  document.body.innerHTML = ''
})

export { createPinia }
