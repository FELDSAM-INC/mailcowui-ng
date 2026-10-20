// The route map (data-model §5, research R19). Features register their routes through their
// `routes.ts`, added to `featureRoutes` below. Every catalogue entry that is not available yet gets
// a placeholder route at its section root, and a catch-all shows "not found". Every route
// component is lazy-loaded (constitution VII).
import type { RouteRecordRaw } from 'vue-router'

import { administratorRoutes } from '@/features/administrators/routes'
import { accountRoutes, mailboxSelfServiceRoutes } from '@/features/account/routes'
import { aliasDomainRoutes } from '@/features/alias-domains/routes'
import { aliasRoutes } from '@/features/aliases/routes'
import { resourceRoutes } from '@/features/resources/routes'
import { apiKeysRoutes } from '@/features/api-keys/routes'
import { auditLogRoutes } from '@/features/audit-log/routes'
import { authRoutes } from '@/features/auth/routes'
import { dnsRoutes } from '@/features/dns/routes'
import { domainRoutes } from '@/features/domains/routes'
import { homeRoutes } from '@/features/home/routes'
import { filterRoutes } from '@/features/filters/routes'
import { identityProviderRoutes } from '@/features/identity-providers/routes'
import { mailboxRoutes } from '@/features/mailboxes/routes'
import { operationsRoutes } from '@/features/operations/routes'
import { quarantineRoutes } from '@/features/quarantine/routes'
import { rateLimitRoutes } from '@/features/rate-limits/routes'
import { spamFilterRoutes } from '@/features/spam-filter/routes'
import { syncJobRoutes } from '@/features/sync-jobs/routes'
import { systemSettingsRoutes } from '@/features/system-settings/routes'
import { routingRoutes } from '@/features/routing/routes'

import { findEntry, placeholderRouteSpecs } from '../navigation/catalogue'

import './route-kinds'

const PlaceholderPage = () => import('../states/PlaceholderPage.vue')
const NotFoundPage = () => import('../states/NotFoundPage.vue')

/** Routes of the features, from their `routes.ts` (US1 adds auth and home, and so on). */
export const featureRoutes: RouteRecordRaw[] = [
  ...authRoutes,
  ...administratorRoutes,
  ...homeRoutes,
  ...apiKeysRoutes,
  ...auditLogRoutes,
  ...domainRoutes,
  ...aliasRoutes,
  ...aliasDomainRoutes,
  ...resourceRoutes,
  ...mailboxRoutes,
  ...syncJobRoutes,
  ...identityProviderRoutes,
  ...dnsRoutes,
  ...routingRoutes,
  ...systemSettingsRoutes,
  ...operationsRoutes,
  // UI 006
  ...quarantineRoutes,
  ...rateLimitRoutes,
  ...spamFilterRoutes,
  // UI 005: My account.
  ...filterRoutes,
  ...accountRoutes,
  ...mailboxSelfServiceRoutes,
]

export function buildRoutes(): RouteRecordRaw[] {
  return [
    ...featureRoutes,
    { path: '/administrators', redirect: '/administrators/admins' },
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
