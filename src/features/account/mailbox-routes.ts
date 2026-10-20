import type { RouteRecordRaw } from 'vue-router'
import { legacy, loadFeatureMessages } from '@/i18n'
function page<T>(load: () => Promise<T>): () => Promise<T> {
  return () => Promise.all([load(), loadFeatureMessages('account')]).then(([module]) => module)
}
export const mailboxSelfServiceRoutes: RouteRecordRaw[] = [
  {
    path: '/mailboxes/:address([^/]+@[^/]+)/app-passwords',
    component: page(() => import('./components/layout/MailboxAccountLayout.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'mailboxes',
      accountSection: 'appPasswords',
    },
    children: [
      {
        path: '',
        name: 'mailbox-app-passwords',
        component: page(() => import('./pages/AppPasswordsPage.vue')),
        meta: { titleKey: legacy('user.app_passwds') },
      },
      {
        path: 'new',
        name: 'mailbox-app-password-create',
        component: page(() => import('./pages/AppPasswordCreatePage.vue')),
        meta: { titleKey: legacy('add.app_password') },
      },
      {
        path: ':appPasswordId(\\d+)',
        name: 'mailbox-app-password-detail',
        component: page(() => import('./pages/AppPasswordDetailPage.vue')),
        meta: { titleKey: legacy('edit.app_passwd') },
      },
    ],
  },
]
