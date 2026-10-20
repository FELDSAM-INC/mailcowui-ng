// The self-service handlers of UI 005 (research R24): one module per area, registered in
// tests/mocks/handlers/index.ts.
import type { RequestHandler } from 'msw'

import { appPasswordHandlers } from './app-passwords'
import { capabilityHandlers } from './capabilities'
import { clientSetupHandlers } from './client-setup'
import { recentLoginHandlers } from './recent-logins'
import { sieveFilterHandlers } from './sieve-filters'
import { groupwareHandlers } from './groupware'
import { mailSettingsHandlers } from './mail-settings'
import { overviewHandlers } from './overview'
import { ownAccountHandlers, recoveryEmailHandlers } from './own-account'
import { passwordResetHandlers } from './password-reset'
import { secondFactorHandlers } from './second-factors'
import { temporaryAliasHandlers } from './temporary-aliases'
import { pushNotificationHandlers } from './push-notifications'
import { bulkMailSettingsHandlers } from './bulk-mail-settings'

export const selfServiceHandlers: RequestHandler[] = [
  ...capabilityHandlers,
  ...clientSetupHandlers,
  ...recentLoginHandlers,
  ...sieveFilterHandlers,
  ...groupwareHandlers,
  ...mailSettingsHandlers,
  ...appPasswordHandlers,
  ...temporaryAliasHandlers,
  ...pushNotificationHandlers,
  ...bulkMailSettingsHandlers,
  ...overviewHandlers,
  ...ownAccountHandlers,
  ...secondFactorHandlers,
  ...recoveryEmailHandlers,
  ...passwordResetHandlers,
]
