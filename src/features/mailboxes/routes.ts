// The routes of UI 003 (data-model §5, under the forms rule). Every component is lazy-loaded,
// together with the feature's own strings (`loadFeatureMessages`), which the shell does not bundle.
import type { RouteRecordRaw } from 'vue-router'

import { legacy, loadFeatureMessages } from '@/i18n'

/** A page and the mailbox strings, loaded together. */
function page<T>(load: () => Promise<T>): () => Promise<T> {
  return () =>
    Promise.all([load(), loadFeatureMessages('mailboxes'), loadFeatureMessages('quarantine')]).then(
      ([module]) => module,
    )
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
    path: '/mailboxes/new',
    name: 'mailbox-create',
    component: page(() => import('./pages/MailboxCreatePage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'mailboxes',
      titleKey: legacy('mailbox.add_mailbox'),
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
  {
    path: '/mailbox-templates',
    name: 'mailbox-templates',
    component: page(() => import('./pages/templates/MailboxTemplatesPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'mailboxTemplates',
      titleKey: legacy('mailbox.mailbox_templates'),
    },
  },
  {
    path: '/mailbox-templates/new',
    name: 'mailbox-template-create',
    component: page(() => import('./pages/templates/MailboxTemplateCreatePage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'mailboxTemplates',
      roles: ['admin'],
      titleKey: legacy('mailbox.add_template'),
    },
  },
  {
    path: '/mailbox-templates/:templateId(\\d+)',
    name: 'mailbox-template-detail',
    component: page(() => import('./pages/templates/MailboxTemplateDetailPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'mailboxTemplates',
      titleKey: legacy('edit.title'),
    },
  },
]
