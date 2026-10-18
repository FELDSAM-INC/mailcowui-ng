// The route map (data-model §5, research R19). Features register their routes through their
// `routes.ts`, added to `featureRoutes` below. Every catalogue entry that is not available yet gets
// a placeholder route at its section root, and a catch-all shows "not found". Every route
// component is lazy-loaded (constitution VII).
import type { RouteRecordRaw } from 'vue-router'

import { apiKeysRoutes } from '@/features/api-keys'
import { authRoutes } from '@/features/auth'
import { homeRoutes } from '@/features/home'

import { placeholderRouteSpecs } from '../navigation/catalogue'

import './route-kinds'

const PlaceholderPage = () => import('../states/PlaceholderPage.vue')
const NotFoundPage = () => import('../states/NotFoundPage.vue')

/** Routes of the features, from their `routes.ts` (US1 adds auth and home, and so on). */
export const featureRoutes: RouteRecordRaw[] = [...authRoutes, ...homeRoutes, ...apiKeysRoutes]

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
        titleKey: `nav.${spec.navEntry}`,
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
