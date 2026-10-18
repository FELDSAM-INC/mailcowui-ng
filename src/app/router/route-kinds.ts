// Route metadata (data-model §5) and the route groups the guard and the session lifecycle use.
import type { RouteLocationNormalizedGeneric, RouteRecordNameGeneric } from 'vue-router'

import type { NavEntryId } from '../navigation/catalogue'

declare module 'vue-router' {
  interface RouteMeta {
    /** `shell` for signed-in pages, `auth` for the sign-in flow; unset follows the session. */
    layout?: 'auth' | 'shell'
    /**
     * Who may open the route: `anonymous` (sign-in screens), `pendingSecondFactor`, `restricted`
     * (pending actions), `session` (an active session) or `public` (not found).
     */
    access?: 'anonymous' | 'pendingSecondFactor' | 'restricted' | 'session' | 'public'
    /** The catalogue entry whose access rule applies (FR-045). */
    navEntry?: NavEntryId
    /** Translation key of the page name in the document title (FR-049). */
    titleKey?: string
  }
}

export const SIGN_IN_ROUTES: ReadonlySet<string> = new Set([
  'sign-in',
  'sign-in-admin',
  'sign-in-domain-admin',
  'sign-in-mailbox-user',
])

type Named = { name?: RouteRecordNameGeneric | null }

export function isSignInRoute(route: Named): boolean {
  return typeof route.name === 'string' && SIGN_IN_ROUTES.has(route.name)
}

/** The sign-in screens, the second-factor step and the pending-actions screen. */
export function isAuthFlowRoute(route: Named): boolean {
  return (
    isSignInRoute(route) ||
    route.name === 'sign-in-second-factor' ||
    route.name === 'pending-actions'
  )
}

export function isShellRoute(route: Pick<RouteLocationNormalizedGeneric, 'meta'>): boolean {
  return route.meta.layout === 'shell'
}
