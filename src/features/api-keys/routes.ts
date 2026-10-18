// Routes of the API keys (data-model §5): administrators only, through the catalogue entry
// `apiKeys` (FR-063). Every component is lazy-loaded (constitution VII).
import type { RouteRecordRaw } from 'vue-router'

const meta = (titleKey: string) =>
  ({ layout: 'shell', access: 'session', navEntry: 'apiKeys', titleKey }) as const

export const apiKeysRoutes: RouteRecordRaw[] = [
  {
    path: '/api-keys',
    name: 'api-keys',
    component: () => import('./pages/ApiKeysPage.vue'),
    meta: meta('apiKeys.title'),
  },
  {
    path: '/api-keys/new',
    name: 'api-key-create',
    component: () => import('./pages/ApiKeyCreatePage.vue'),
    meta: meta('apiKeys.create.title'),
  },
  {
    path: '/api-keys/:apiKeyId([0-9A-HJKMNP-TV-Z]{26})',
    name: 'api-key-detail',
    component: () => import('./pages/ApiKeyDetailPage.vue'),
    props: true,
    meta: meta('apiKeys.detail.title'),
  },
]
