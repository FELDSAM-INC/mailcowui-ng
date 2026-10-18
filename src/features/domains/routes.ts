// The routes of UI 002 (data-model §5). Every component is lazy-loaded (research D30).
import type { RouteRecordRaw } from 'vue-router'

import { legacy } from '@/i18n'

export const domainRoutes: RouteRecordRaw[] = [
  {
    path: '/domains',
    name: 'domains',
    component: () => import('./pages/DomainListPage.vue'),
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
    component: () => import('./pages/DomainCreatePage.vue'),
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
    component: () => import('./pages/DomainDetailPage.vue'),
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
    component: () => import('./pages/TemplateListPage.vue'),
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
    component: () => import('./pages/TemplateCreatePage.vue'),
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
    component: () => import('./pages/TemplateDetailPage.vue'),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'domainTemplates',
      titleKey: legacy('edit.title'),
    },
  },
]
