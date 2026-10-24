// The routes of My account (UI 005 data-model §5). Every page is lazy-loaded together with the
// feature's own strings. The section routes are children of the hub's layout, so the section
// navigation stays above every page, including Passkeys; each names its section, and
// the layout shows "no access" in place when the account may not use it.
import type { RouteRecordRaw } from 'vue-router'

import { legacy, loadFeatureMessages } from '@/i18n'
import { passkeysRoutes } from '@/features/passkeys'

export { mailboxSelfServiceRoutes } from './mailbox-routes'

import type { AccountSectionId } from './sections'

declare module 'vue-router' {
  interface RouteMeta {
    /** UI 005: the My account section of the route. */
    accountSection?: AccountSectionId
  }
}

/** A page and the account strings, loaded together. */
export function accountPage<T>(load: () => Promise<T>): () => Promise<T> {
  return () => Promise.all([load(), loadFeatureMessages('account')]).then(([module]) => module)
}

export const accountRoutes: RouteRecordRaw[] = [
  {
    path: '/account',
    component: accountPage(() => import('./components/layout/AccountLayout.vue')),
    meta: { layout: 'shell', access: 'session', navEntry: 'account' },
    children: [
      ...passkeysRoutes,
      {
        path: 'overview',
        name: 'account-overview',
        component: accountPage(() => import('./pages/OverviewPage.vue')),
        meta: {
          accountSection: 'overview',
          titleKey: legacy('user.overview'),
          roles: ['mailboxUser'],
        },
      },
      {
        path: 'filters',
        name: 'account-filters',
        component: accountPage(() => import('./pages/OwnFiltersPage.vue')),
        meta: { accountSection: 'activeScript', titleKey: legacy('user.active_sieve') },
      },
      {
        path: 'push-notifications',
        name: 'account-push-notifications',
        component: accountPage(() => import('./pages/PushNotificationsPage.vue')),
        meta: { accountSection: 'pushNotifications', titleKey: legacy('edit.pushover') },
      },
      {
        path: 'recent-logins',
        name: 'account-recent-logins',
        component: accountPage(() => import('./pages/RecentLoginsPage.vue')),
        meta: {
          accountSection: 'recentLogins',
          titleKey: legacy('user.recent_successful_connections'),
        },
      },
      {
        path: 'mail-apps',
        name: 'account-mail-apps',
        component: accountPage(() =>
          Promise.all([import('./pages/MailAppsPage.vue'), loadFeatureMessages('mailboxes')]).then(
            ([module]) => module,
          ),
        ),
        meta: { accountSection: 'mailApps', titleKey: 'account.sections.mailApps' },
      },
      {
        path: 'mail-settings',
        name: 'account-mail-settings',
        component: accountPage(() => import('./pages/MailSettingsPage.vue')),
        meta: { accountSection: 'mailSettings', titleKey: legacy('user.mailbox_settings') },
      },
      {
        path: 'temporary-aliases/new',
        name: 'account-temporary-alias-create',
        component: accountPage(() => import('./pages/TemporaryAliasCreatePage.vue')),
        meta: { accountSection: 'temporaryAliases', titleKey: 'account.temporaryAliases.create' },
      },
      {
        path: 'temporary-aliases',
        name: 'account-temporary-aliases',
        component: accountPage(() => import('./pages/TemporaryAliasesPage.vue')),
        meta: { accountSection: 'temporaryAliases', titleKey: legacy('user.spam_aliases') },
      },
      {
        path: '',
        name: 'account',
        // The session guard resolves the role's account entry before mounting this page.
        component: accountPage(() => import('./pages/OverviewPage.vue')),
      },
      {
        path: 'app-passwords',
        name: 'account-app-passwords',
        component: accountPage(() => import('./pages/AppPasswordsPage.vue')),
        meta: { accountSection: 'appPasswords', titleKey: legacy('user.app_passwds') },
      },
      {
        path: 'app-passwords/new',
        name: 'account-app-password-create',
        component: accountPage(() => import('./pages/AppPasswordCreatePage.vue')),
        meta: { accountSection: 'appPasswords', titleKey: legacy('add.app_password') },
      },
      {
        path: 'app-passwords/:appPasswordId(\\d+)',
        name: 'account-app-password-detail',
        component: accountPage(() => import('./pages/AppPasswordDetailPage.vue')),
        meta: { accountSection: 'appPasswords', titleKey: legacy('edit.app_passwd') },
      },
      {
        path: 'password',
        name: 'account-password',
        component: accountPage(() => import('./pages/PasswordPage.vue')),
        meta: { accountSection: 'password', titleKey: legacy('user.change_password') },
      },
      {
        path: 'recovery-email',
        name: 'account-recovery-email',
        component: accountPage(() => import('./pages/RecoveryEmailPage.vue')),
        meta: { accountSection: 'recoveryEmail', titleKey: legacy('user.pw_recovery_email') },
      },
      {
        path: 'two-factor',
        name: 'account-two-factor',
        component: accountPage(() => import('./pages/TwoFactorPage.vue')),
        meta: { accountSection: 'twoFactor', titleKey: legacy('tfa.tfa') },
      },
      {
        path: 'two-factor/add/:method(totp|webauthn|yubi-otp)',
        name: 'account-two-factor-add',
        component: accountPage(() => import('./pages/AddSecondFactorPage.vue')),
        meta: { accountSection: 'twoFactor', titleKey: legacy('tfa.set_tfa') },
      },
    ],
  },
]
