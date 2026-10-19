// The routes of the OAuth2 apps screens (UI 012 US5, data-model §5). Every component is
// lazy-loaded with the feature's strings; the catalogue entry `identityProviders` (administrators only) applies to all.
import type { RouteRecordRaw } from 'vue-router'

import { legacy } from '@/i18n'

import { page } from '../load'

const meta = { layout: 'shell', access: 'session', navEntry: 'identityProviders' } as const

export const oauth2Routes: RouteRecordRaw[] = [
  {
    path: '/identity-providers/oauth2-apps',
    name: 'oauth2-clients',
    component: page(() => import('./pages/Oauth2ClientsPage.vue')),
    meta: { ...meta, titleKey: legacy('admin.oauth2_apps') },
  },
  {
    path: '/identity-providers/oauth2-apps/new',
    name: 'oauth2-client-create',
    component: page(() => import('./pages/Oauth2ClientCreatePage.vue')),
    meta: { ...meta, titleKey: legacy('admin.oauth2_add_client') },
  },
  {
    path: '/identity-providers/oauth2-apps/:oauth2ClientId(\\d{1,10})',
    name: 'oauth2-client-detail',
    component: page(() => import('./pages/Oauth2ClientDetailPage.vue')),
    meta: { ...meta, titleKey: 'oauth2.title' },
  },
]
