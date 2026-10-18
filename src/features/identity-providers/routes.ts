// The routes of UI 012's admin screens (data-model §5): `/identity-providers` opens the identity
// provider screen; the OAuth2 apps screens come from `./oauth2/routes`. Every component is
// lazy-loaded. The catalogue entry `identityProviders` (administrators only) applies to all of them.
import type { RouteRecordRaw } from 'vue-router'

import { legacy } from '@/i18n'

import { oauth2Routes } from './oauth2/routes'

export const identityProviderRoutes: RouteRecordRaw[] = [
  {
    path: '/identity-providers',
    name: 'identity-providers',
    redirect: { name: 'identity-provider' },
  },
  {
    path: '/identity-providers/provider',
    name: 'identity-provider',
    component: () => import('./provider/pages/IdentityProviderPage.vue'),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'identityProviders',
      titleKey: legacy('admin.iam'),
    },
  },
  ...oauth2Routes,
]
