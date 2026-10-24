// UI feature 005, account self-service. Other code reaches it only through this file; it exports
// routes and light modules only (research R25).
import { defineAsyncComponent } from 'vue'
import type { QueryClient } from '@tanstack/vue-query'

import type { LandingContext } from '@/app/session/landing'
import { loadFeatureMessages } from '@/i18n'

export { accountRoutes } from './routes'
export { mailboxSelfServiceRoutes } from './mailbox-routes'
export { useMailSettingsEditor } from './composables/useMailSettingsEditor'
export { useAccountSidebar } from './composables/useAccountSidebar'
export { applyMailboxMailSettingsBulk, mailSettingsBulkRequest } from './api/bulk-mail-settings'
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

export const MailboxAccountLinks = defineAsyncComponent(
  () => import('./components/layout/MailboxAccountLinks.vue'),
)
export const MailboxContextHeader = defineAsyncComponent(
  () => import('./components/layout/MailboxContextHeader.vue'),
)

export const MailboxHomeCard = defineAsyncComponent(() =>
  Promise.all([
    import('./components/overview/MailboxHomeCard.vue'),
    loadFeatureMessages('account'),
  ]).then(([module]) => module),
)

/** Loaded only after an eligible mailbox sign-in; account forms stay outside the sign-in shell. */
export async function forwardAfterSignIn(context: LandingContext, queryClient: QueryClient) {
  const [module] = await Promise.all([
    import('./webmail-forwarding'),
    loadFeatureMessages('account'),
  ])
  return module.forwardToWebmail(context, queryClient)
}

/** The editable Pushover section in the classic mailbox detail position. */
export const PushNotificationsSection = defineAsyncComponent(() =>
  Promise.all([import('./pages/PushNotificationsPage.vue'), loadFeatureMessages('account')]).then(
    ([module]) => module,
  ),
)
