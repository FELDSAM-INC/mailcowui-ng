import type { RouteRecordRaw } from 'vue-router'
import { filterPages } from '@/features/filters'
import { legacy, loadFeatureMessages } from '@/i18n'
function page<T>(load: () => Promise<T>): () => Promise<T> {
  return () => Promise.all([load(), loadFeatureMessages('account')]).then(([module]) => module)
}
export const mailboxSelfServiceRoutes: RouteRecordRaw[] = [
  {
    path: '/mailboxes/:address([^/]+@[^/]+|[^/]+%40[^/]+)/filters',
    component: page(() => import('./components/layout/MailboxAccountLayout.vue')),
    meta: { layout: 'shell', access: 'session', navEntry: 'mailboxes', accountSection: 'filters' },
    children: [
      {
        path: '',
        name: 'mailbox-filters',
        component: filterPages.mailbox,
        meta: { titleKey: legacy('mailbox.filters') },
      },
      {
        path: 'new',
        name: 'mailbox-filter-create',
        component: filterPages.form,
        meta: { titleKey: 'filters.form.title' },
      },
      {
        path: ':filterId(\\d+)',
        name: 'mailbox-filter-detail',
        component: filterPages.form,
        meta: { titleKey: 'filters.form.title' },
      },
    ],
  },
  {
    path: '/mailboxes/:address([^/]+@[^/]+|[^/]+%40[^/]+)/push-notifications',
    component: page(() => import('./components/layout/MailboxAccountLayout.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'mailboxes',
      accountSection: 'pushNotifications',
    },
    children: [
      {
        path: '',
        name: 'mailbox-push-notifications',
        component: page(() => import('./pages/PushNotificationsPage.vue')),
        meta: { titleKey: legacy('edit.pushover') },
      },
    ],
  },
  {
    path: '/mailboxes/:address([^/]+@[^/]+|[^/]+%40[^/]+)/recent-logins',
    component: page(() => import('./components/layout/MailboxAccountLayout.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'mailboxes',
      accountSection: 'recentLogins',
    },
    children: [
      {
        path: '',
        name: 'mailbox-recent-logins',
        component: page(() => import('./pages/RecentLoginsPage.vue')),
        meta: { titleKey: legacy('user.recent_successful_connections') },
      },
    ],
  },
  {
    path: '/mailboxes/:address([^/]+@[^/]+|[^/]+%40[^/]+)/mail-settings',
    component: page(() => import('./components/layout/MailboxAccountLayout.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'mailboxes',
      accountSection: 'mailSettings',
    },
    children: [
      {
        path: '',
        name: 'mailbox-mail-settings',
        component: page(() => import('./pages/MailSettingsPage.vue')),
        meta: { titleKey: legacy('user.mailbox_settings') },
      },
    ],
  },
  {
    path: '/mailboxes/:address([^/]+@[^/]+|[^/]+%40[^/]+)/temporary-aliases',
    component: page(() => import('./components/layout/MailboxAccountLayout.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'mailboxes',
      accountSection: 'temporaryAliases',
    },
    children: [
      {
        path: 'new',
        name: 'mailbox-temporary-alias-create',
        component: page(() => import('./pages/TemporaryAliasCreatePage.vue')),
        meta: { titleKey: 'account.temporaryAliases.create' },
      },
      {
        path: '',
        name: 'mailbox-temporary-aliases',
        component: page(() => import('./pages/TemporaryAliasesPage.vue')),
        meta: { titleKey: legacy('user.spam_aliases') },
      },
    ],
  },
  {
    path: '/mailboxes/:address([^/]+@[^/]+|[^/]+%40[^/]+)/app-passwords',
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
