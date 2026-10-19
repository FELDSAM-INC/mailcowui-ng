// The routes of the alias screens (data-model §5). Every component is lazy-loaded (research R22),
// together with the feature's own strings (`loadFeatureMessages`), which the shell does not bundle.
import type { RouteRecordRaw } from 'vue-router'

import { legacy, loadFeatureMessages } from '@/i18n'

/** A page and the UI 004 strings, loaded together. */
function page<T>(load: () => Promise<T>): () => Promise<T> {
  return () => Promise.all([load(), loadFeatureMessages('aliases')]).then(([module]) => module)
}

export const aliasRoutes: RouteRecordRaw[] = [
  {
    path: '/aliases',
    name: 'aliases',
    component: page(() => import('./pages/AliasesPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'aliases',
      titleKey: legacy('mailbox.aliases'),
    },
  },
  {
    path: '/aliases/new',
    name: 'alias-create',
    component: page(() => import('./pages/AliasCreatePage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'aliases',
      titleKey: legacy('mailbox.add_alias'),
    },
  },
  {
    path: '/aliases/:aliasId(\\d+)',
    name: 'alias-detail',
    component: page(() => import('./pages/AliasDetailPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'aliases',
      titleKey: legacy('edit.alias'),
    },
  },
]
