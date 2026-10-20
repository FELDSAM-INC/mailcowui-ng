// The passkeys page (data-model §5).
import type { RouteRecordRaw } from 'vue-router'

export const passkeysRoutes: RouteRecordRaw[] = [
  {
    path: '/passkeys',
    name: 'passkeys',
    component: () => import('./pages/PasskeysPage.vue'),
    meta: {
      accountSection: 'passkeys',
      layout: 'shell',
      access: 'session',
      navEntry: 'passkeys',
      titleKey: 'passkeys.title',
    },
  },
]
