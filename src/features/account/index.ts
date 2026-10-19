// UI feature 005, account self-service. Other code reaches it only through this file; it exports
// routes and light modules only (research R25).
import { defineAsyncComponent } from 'vue'

export { accountRoutes } from './routes'
export { mailboxSelfServiceRoutes } from './mailbox-routes'
export { useSelfServiceCapabilities } from './api/capabilities'
// The pending-actions screen's forced password change (UI 001's auth feature).
export { changeOwnPassword, useOwnPasswordPolicy } from './api/password'
// The pending-actions screen's forced second-factor setup (research R8), loaded when shown so that
// the shell does not carry them (research R25).
export const TotpSetup = defineAsyncComponent(() => import('./components/two-factor/TotpSetup.vue'))
export const SecurityKeySetup = defineAsyncComponent(
  () => import('./components/two-factor/SecurityKeySetup.vue'),
)
export const YubicoOtpSetup = defineAsyncComponent(
  () => import('./components/two-factor/YubicoOtpSetup.vue'),
)
