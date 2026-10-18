// Route metadata (data-model §5) and the route groups the guard and the session lifecycle use.
import type { RouteLocationNormalizedGeneric, RouteRecordNameGeneric } from 'vue-router'

import type { Role } from '@/api'
import type { TextRef } from '@/i18n'

import type { NavEntryId } from '../navigation/catalogue'

declare module 'vue-router' {
  interface RouteMeta {
    /** `shell` for signed-in pages, `auth` for the sign-in flow; unset follows the session. */
    layout?: 'auth' | 'shell'
    /**
     * Who may open the route: `anonymous` (sign-in screens), `pendingSecondFactor`, `restricted`
     * (pending actions) or `session` (an active session).
     */
    access?: 'anonymous' | 'pendingSecondFactor' | 'restricted' | 'session'
    /**
     * The route resolves in every session state (docs/conventions.md: `meta.public`), for example
     * the password reset pages of UI 005.
     */
    public?: boolean
    /** The catalogue entry whose access rule applies (FR-045). */
    navEntry?: NavEntryId
    /**
     * The page name in the document title (FR-049): a new string's key, or one of mailcow's own
     * strings (`legacy('tfa.tfa')`).
     */
    titleKey?: TextRef
    /**
     * UI 002 (research D4): the roles that may open the route, narrower than its catalogue entry,
     * for example creating a domain. Other roles get "no access" in place.
     */
    roles?: Role[]
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
