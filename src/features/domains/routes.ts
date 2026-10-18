// The routes of UI 002 (data-model §5). Every component is lazy-loaded (research D30), together with
// the feature's own strings (`loadFeatureMessages`), which the shell does not bundle.
import type { RouteRecordRaw } from 'vue-router'

import { legacy, loadFeatureMessages } from '@/i18n'

/** A page and the domain strings, loaded together. */
function page<T>(load: () => Promise<T>): () => Promise<T> {
  return () => Promise.all([load(), loadFeatureMessages('domains')]).then(([module]) => module)
}

export const domainRoutes: RouteRecordRaw[] = [
  {
    path: '/domains',
    name: 'domains',
    component: page(() => import('./pages/DomainListPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'domains',
      titleKey: legacy('mailbox.domains'),
    },
  },
  {
    path: '/domains/-/new',
    name: 'domain-create',
    component: page(() => import('./pages/DomainCreatePage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'domains',
      roles: ['admin'],
      titleKey: legacy('mailbox.add_domain'),
    },
  },
  {
    path: '/domains/:domain',
    name: 'domain-detail',
    component: page(() => import('./pages/DomainDetailPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'domains',
      titleKey: legacy('edit.domain'),
    },
  },
  {
    path: '/domain-templates',
    name: 'domain-templates',
    component: page(() => import('./pages/TemplateListPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'domainTemplates',
      titleKey: legacy('mailbox.domain_templates'),
    },
  },
  {
    path: '/domain-templates/new',
    name: 'domain-template-create',
    component: page(() => import('./pages/TemplateCreatePage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'domainTemplates',
      titleKey: legacy('mailbox.add_template'),
    },
  },
  {
    path: '/domain-templates/:templateId(\\d+)',
    name: 'domain-template-detail',
    component: page(() => import('./pages/TemplateDetailPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'domainTemplates',
      titleKey: legacy('edit.title'),
    },
  },
]
