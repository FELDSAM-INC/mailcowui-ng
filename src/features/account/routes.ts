// The routes of My account (UI 005 data-model §5). Every page is lazy-loaded together with the
// feature's own strings. The section routes are children of the hub's layout, so the section
// navigation stays beside them from `lg` up; each names its section (`meta.accountSection`), and
// the layout shows "no access" in place when the account may not use it.
import type { RouteRecordRaw } from 'vue-router'

import { legacy, loadFeatureMessages } from '@/i18n'

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
      {
        path: '',
        name: 'account',
        component: accountPage(() => import('./pages/AccountHomePage.vue')),
        meta: { titleKey: legacy('header.user_settings') },
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
