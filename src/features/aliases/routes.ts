// The routes of the alias screens (data-model §5). Every component is lazy-loaded (research R22).
import type { RouteRecordRaw } from 'vue-router'

import { legacy } from '@/i18n'

export const aliasRoutes: RouteRecordRaw[] = [
  {
    path: '/aliases',
    name: 'aliases',
    component: () => import('./pages/AliasesPage.vue'),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'aliases',
      titleKey: legacy('mailbox.aliases'),
    },
  },
  {
    path: '/aliases/:aliasId(\\d+)',
    name: 'alias-detail',
    component: () => import('./pages/AliasDetailPage.vue'),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'aliases',
      titleKey: legacy('edit.alias'),
    },
  },
]
