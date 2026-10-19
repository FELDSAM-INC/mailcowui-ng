// The routes of UI 003 (data-model §5, under the forms rule). Every component is lazy-loaded.
import type { RouteRecordRaw } from 'vue-router'

import { legacy } from '@/i18n'

export const mailboxRoutes: RouteRecordRaw[] = [
  {
    path: '/mailboxes',
    name: 'mailboxes',
    component: () => import('./pages/MailboxesPage.vue'),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'mailboxes',
      titleKey: legacy('mailbox.mailboxes'),
    },
  },
  {
    path: '/mailboxes/:address([^/]+@[^/]+)',
    name: 'mailbox-detail',
    component: () => import('./pages/MailboxDetailPage.vue'),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'mailboxes',
      titleKey: legacy('edit.mailbox'),
    },
  },
]
