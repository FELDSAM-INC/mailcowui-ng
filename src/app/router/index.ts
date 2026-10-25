// The app's router (research R19): history mode under the deployment base, the route map, the
// session guard, focus management and the document title.
import {
  createRouter,
  createWebHistory,
  START_LOCATION,
  type RouteLocationNormalized,
  type RouterHistory,
  type RouterScrollBehavior,
} from 'vue-router'

import { appBasePath } from '@/shared/platform/app-base'

import { fragmentElement, noteScrollRestored } from './focus'
import { buildRoutes } from './routes'

type ScrollResult = ReturnType<RouterScrollBehavior>

/**
 * Scrolling after a navigation (UI 002 research D9, FR-013): Back and Forward restore the saved
 * position, so a list shows the previous results where they were. A query-only change on the same
 * page (typing a search, a filter, a section's `edit`, a step) keeps the position, except a new
 * page number, which starts at the top. Everything else starts at the top or at its hash.
 */
export function appScrollBehavior(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  saved: { left: number; top: number } | null,
): ScrollResult {
  noteScrollRestored(!!saved)
  if (saved) return saved
  if (to.hash) {
    if (to.path === from.path && to.hash === from.hash) return false
    // Safe decoding and id lookup; a lazy target is scrolled by the focus observer when ready.
    const element = fragmentElement(to.hash)
    return element ? { el: element } : false
  }
  // A fresh document already starts at its natural position. Avoid forcing layout with an
  // unnecessary scrollTo while its first route mounts; saved history and fragments still win.
  if (from === START_LOCATION) return false
  if (to.path === from.path) return to.query.page !== from.query.page ? { top: 0 } : false
  return { top: 0 }
}

export function createAppRouter(history: RouterHistory = createWebHistory(appBasePath())) {
  return createRouter({ history, routes: buildRoutes(), scrollBehavior: appScrollBehavior })
}
