// The routes of UI 003 (data-model §5, under the forms rule). Every component is lazy-loaded,
// together with the feature's own strings (`loadFeatureMessages`), which the shell does not bundle.
import type { RouteRecordRaw } from 'vue-router'

import { legacy, loadFeatureMessages } from '@/i18n'

/** A page and the mailbox strings, loaded together. */
function page<T>(load: () => Promise<T>): () => Promise<T> {
  return () => Promise.all([load(), loadFeatureMessages('mailboxes')]).then(([module]) => module)
}

export const mailboxRoutes: RouteRecordRaw[] = [
  {
    path: '/mailboxes',
    name: 'mailboxes',
    component: page(() => import('./pages/MailboxesPage.vue')),
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
    component: page(() => import('./pages/MailboxDetailPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'mailboxes',
      titleKey: legacy('edit.mailbox'),
    },
  },
]
