// Routes of the sign-in flow (data-model §5). Every component is lazy-loaded (constitution VII).
import type { RouteRecordRaw } from 'vue-router'

import { legacy, loadFeatureMessages, type TextRef } from '@/i18n'

const SignInPage = () => import('./pages/SignInPage.vue')
const SecondFactorPage = () => import('./pages/SecondFactorPage.vue')
// UI 005 (research R8): the forced second-factor setup uses My account's enrolment, with its strings.
const PendingActionsPage = () =>
  Promise.all([import('./pages/PendingActionsPage.vue'), loadFeatureMessages('account')]).then(
    ([module]) => module,
  )
const SingleSignOnReturnPage = () => import('./pages/SingleSignOnReturnPage.vue')
// UI 005 (research R12): the password reset pages, public in every session state.
const PasswordResetRequestPage = () =>
  Promise.all([
    import('./pages/PasswordResetRequestPage.vue'),
    loadFeatureMessages('account'),
  ]).then(([module]) => module)
const PasswordResetPage = () =>
  Promise.all([import('./pages/PasswordResetRoute.vue'), loadFeatureMessages('account')]).then(
    ([module]) => module,
  )

const signIn = (path: string, name: string, role: string | null, titleKey: TextRef) =>
  ({
    path,
    name,
    component: SignInPage,
    props: { role },
    meta: { layout: 'auth', access: 'anonymous', titleKey },
  }) satisfies RouteRecordRaw

export const authRoutes: RouteRecordRaw[] = [
  signIn('/sign-in', 'sign-in', null, legacy('login.login')),
  signIn('/sign-in/admin', 'sign-in-admin', 'admin', legacy('login.login_admin')),
  signIn(
    '/sign-in/domain-admin',
    'sign-in-domain-admin',
    'domainAdmin',
    legacy('login.login_dadmin'),
  ),
  signIn(
    '/sign-in/mailbox-user',
    'sign-in-mailbox-user',
    'mailboxUser',
    legacy('login.login_user'),
  ),
  {
    path: '/sign-in/second-factor',
    name: 'sign-in-second-factor',
    component: SecondFactorPage,
    meta: { layout: 'auth', access: 'pendingSecondFactor', titleKey: legacy('tfa.tfa') },
  },
  {
    path: '/pending-actions',
    name: 'pending-actions',
    component: PendingActionsPage,
    meta: { layout: 'auth', access: 'restricted', titleKey: 'auth.pendingActions.title' },
  },
  // UI 012 (FR-045): the return from the provider resolves in every session state (`meta.public`);
  // the page decides what happens.
  {
    path: '/sso/return',
    name: 'sso-return',
    component: SingleSignOnReturnPage,
    meta: { layout: 'auth', public: true, titleKey: legacy('admin.iam_sso') },
  },
  {
    path: '/reset-password/request',
    name: 'password-reset-request',
    component: PasswordResetRequestPage,
    meta: { layout: 'auth', public: true, titleKey: legacy('login.reset_password') },
  },
  {
    path: '/reset-password',
    name: 'password-reset',
    component: PasswordResetPage,
    meta: { layout: 'auth', public: true, titleKey: legacy('login.reset_password') },
  },
]
