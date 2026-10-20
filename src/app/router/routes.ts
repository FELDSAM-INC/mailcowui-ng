// The route map (data-model §5, research R19). Features register their routes through their
// `routes.ts`, added to `featureRoutes` below. Every catalogue entry that is not available yet gets
// a placeholder route at its section root, and a catch-all shows "not found". Every route
// component is lazy-loaded (constitution VII).
import type { RouteRecordRaw } from 'vue-router'

import { accountRoutes, mailboxSelfServiceRoutes } from '@/features/account/routes'
import { aliasDomainRoutes } from '@/features/alias-domains'
import { aliasRoutes } from '@/features/aliases'
import { resourceRoutes } from '@/features/resources'
import { apiKeysRoutes } from '@/features/api-keys'
import { auditLogRoutes } from '@/features/audit-log'
import { authRoutes } from '@/features/auth'
import { dnsRoutes } from '@/features/dns'
import { domainRoutes } from '@/features/domains'
import { homeRoutes } from '@/features/home'
import { filterRoutes } from '@/features/filters/routes'
import { identityProviderRoutes } from '@/features/identity-providers'
import { mailboxRoutes } from '@/features/mailboxes'
import { operationsRoutes } from '@/features/operations'
import { passkeysRoutes } from '@/features/passkeys'
import { quarantineRoutes } from '@/features/quarantine/routes'
import { rateLimitRoutes } from '@/features/rate-limits/routes'
import { spamFilterRoutes } from '@/features/spam-filter/routes'
import { syncJobRoutes } from '@/features/sync-jobs'
import { systemSettingsRoutes } from '@/features/system-settings/routes'
import { routingRoutes } from '@/features/routing'

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
