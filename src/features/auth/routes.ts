// Routes of the sign-in flow (data-model §5). Every component is lazy-loaded (constitution VII).
import type { RouteRecordRaw } from 'vue-router'

import { legacy, type TextRef } from '@/i18n'

const SignInPage = () => import('./pages/SignInPage.vue')
const SecondFactorPage = () => import('./pages/SecondFactorPage.vue')
const PendingActionsPage = () => import('./pages/PendingActionsPage.vue')

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
]
