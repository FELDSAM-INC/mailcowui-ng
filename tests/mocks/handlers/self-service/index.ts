// The self-service handlers of UI 005 (research R24): one module per area, registered in
// tests/mocks/handlers/index.ts.
import type { RequestHandler } from 'msw'

import { capabilityHandlers } from './capabilities'
import { overviewHandlers } from './overview'
import { ownAccountHandlers, recoveryEmailHandlers } from './own-account'
import { passwordResetHandlers } from './password-reset'
import { secondFactorHandlers } from './second-factors'

export const selfServiceHandlers: RequestHandler[] = [
  ...capabilityHandlers,
  ...overviewHandlers,
  ...ownAccountHandlers,
  ...secondFactorHandlers,
  ...recoveryEmailHandlers,
  ...passwordResetHandlers,
]
