// The self-service handlers of UI 005 (research R24): one module per area, registered in
// tests/mocks/handlers/index.ts.
import type { RequestHandler } from 'msw'

import { capabilityHandlers } from './capabilities'
import { overviewHandlers } from './overview'
import { ownAccountHandlers } from './own-account'

export const selfServiceHandlers: RequestHandler[] = [
  ...capabilityHandlers,
  ...overviewHandlers,
  ...ownAccountHandlers,
]
