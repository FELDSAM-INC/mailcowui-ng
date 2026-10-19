// The routes of the resource screens (data-model §5). Every component is lazy-loaded (research
// R22), together with UI 004's strings (`loadFeatureMessages`), which the shell does not bundle.
import type { RouteRecordRaw } from 'vue-router'

import { legacy, loadFeatureMessages } from '@/i18n'

function page<T>(load: () => Promise<T>): () => Promise<T> {
  return () => Promise.all([load(), loadFeatureMessages('aliases')]).then(([module]) => module)
}

export const resourceRoutes: RouteRecordRaw[] = [
  {
    path: '/resources',
    name: 'resources',
    component: page(() => import('./pages/ResourcesPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'resources',
      titleKey: legacy('mailbox.resources'),
    },
  },
  {
    path: '/resources/new',
    name: 'resource-create',
    component: page(() => import('./pages/ResourceCreatePage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'resources',
      titleKey: legacy('mailbox.add_resource'),
    },
  },
  {
    path: '/resources/:resourceAddress([^/]+@[^/]+)',
    name: 'resource-detail',
    component: page(() => import('./pages/ResourceDetailPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'resources',
      titleKey: legacy('edit.resource'),
    },
  },
]
