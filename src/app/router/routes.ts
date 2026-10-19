// The route map (data-model §5, research R19). Features register their routes through their
// `routes.ts`, added to `featureRoutes` below. Every catalogue entry that is not available yet gets
// a placeholder route at its section root, and a catch-all shows "not found". Every route
// component is lazy-loaded (constitution VII).
import type { RouteRecordRaw } from 'vue-router'

import { aliasDomainRoutes } from '@/features/alias-domains'
import { aliasRoutes } from '@/features/aliases'
import { apiKeysRoutes } from '@/features/api-keys'
import { auditLogRoutes } from '@/features/audit-log'
import { authRoutes } from '@/features/auth'
import { domainRoutes } from '@/features/domains'
import { homeRoutes } from '@/features/home'
import { identityProviderRoutes } from '@/features/identity-providers'
import { mailboxRoutes } from '@/features/mailboxes'
import { passkeysRoutes } from '@/features/passkeys'
import { syncJobRoutes } from '@/features/sync-jobs'

import { findEntry, placeholderRouteSpecs } from '../navigation/catalogue'

import './route-kinds'

const PlaceholderPage = () => import('../states/PlaceholderPage.vue')
const NotFoundPage = () => import('../states/NotFoundPage.vue')

/** Routes of the features, from their `routes.ts` (US1 adds auth and home, and so on). */
export const featureRoutes: RouteRecordRaw[] = [
  ...authRoutes,
  ...homeRoutes,
  ...passkeysRoutes,
  ...apiKeysRoutes,
  ...auditLogRoutes,
  ...domainRoutes,
  ...aliasRoutes,
  ...aliasDomainRoutes,
  ...mailboxRoutes,
  ...syncJobRoutes,
  ...identityProviderRoutes,
]

export function buildRoutes(): RouteRecordRaw[] {
  return [
    ...featureRoutes,
    ...placeholderRouteSpecs().map((spec): RouteRecordRaw => ({
      path: spec.path,
      name: spec.name,
      component: PlaceholderPage,
      props: { entryId: spec.navEntry },
      meta: {
        layout: 'shell',
        access: 'session',
        navEntry: spec.navEntry,
        titleKey: findEntry(spec.navEntry)?.labelKey,
      },
    })),
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundPage,
      meta: { titleKey: 'states.notFound.title' },
    },
  ]
}
