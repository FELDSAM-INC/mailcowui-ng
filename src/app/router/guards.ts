// The session state machine in the global guard (FR-030, FR-031, FR-038, FR-050, research R11).
// The session state decides which routes may open; an active session refreshes an identity older
// than five minutes before a shell route opens; a route the catalogue denies still resolves and
// ShellLayout renders "no access" in place (FR-045).
import type { QueryClient } from '@tanstack/vue-query'
import type { RouteLocationNormalizedGeneric, RouteLocationRaw, Router } from 'vue-router'

import type { Identity, SessionState } from '@/api'

import { canAccess } from '../navigation/visibility'
import { identityQuery, isSignedIn, sessionQuery } from '../session/queries'
import { useSessionStore } from '../session/store'
import { acceptReturnTo } from './return-to'
import { isAuthFlowRoute, isShellRoute, isSignInRoute } from './route-kinds'

export interface GuardContext {
  queryClient: QueryClient
  /** Resolves once the bootstrap has succeeded (research R11). */
  ready?: () => Promise<void>
}

type Target = true | RouteLocationRaw

/** The `returnTo` to carry while the user is sent through the sign-in flow. */
function carriedReturnTo(to: RouteLocationNormalizedGeneric, router: Router): string | null {
  if (isAuthFlowRoute(to)) return acceptReturnTo(to.query.returnTo, router)
  return to.fullPath === '/' ? null : acceptReturnTo(to.fullPath, router)
}

function sendTo(router: Router, name: string, returnTo: string | null): Target {
  // A route of a later story that is not registered yet: let the navigation proceed.
  if (!router.hasRoute(name)) return true
  return { name, query: returnTo ? { returnTo } : {}, replace: true }
}

/** Where a session state lets the navigation go (research R11). */
export function routeForState(
  state: SessionState,
  to: RouteLocationNormalizedGeneric,
  router: Router,
): Target {
  if (to.meta.public) return true
  switch (state) {
    case 'anonymous': {
      // "Not found" shows signed out too; during a pending step or a restriction it does not.
      if (to.meta.access === 'anonymous' || to.name === 'not-found') return true
      const returnTo = carriedReturnTo(to, router)
      // UI 005 (research R20): a sign-in that starts from an app address opens that address and
      // is never forwarded to webmail.
      if (returnTo && !isAuthFlowRoute(to)) useSessionStore().landingIntent = 'requested'
      return sendTo(router, 'sign-in', returnTo)
    }
    case 'pendingSecondFactor':
      if (to.name === 'sign-in-second-factor') return true
      return sendTo(router, 'sign-in-second-factor', carriedReturnTo(to, router))
    case 'restricted':
      if (to.name === 'pending-actions') return true
      return sendTo(router, 'pending-actions', carriedReturnTo(to, router))
    case 'active': {
      if (!isAuthFlowRoute(to)) return true
      const store = useSessionStore()
      const target =
        acceptReturnTo(to.query.returnTo, router) ?? acceptReturnTo(store.returnTo, router)
      store.returnTo = null
      // A path with a query (an open section `?edit=…`, list filters) keeps it: `{ path }` would
      // drop everything after the `?` (UI 004 T110).
      const { path, query, hash } = router.resolve(target ?? '/')
      return { path, query, hash, replace: true }
    }
  }
}

/** Whether the identity may use the route's section (FR-045) and the route's roles (UI 002 D4). */
export function routeAccess(
  route: Pick<RouteLocationNormalizedGeneric, 'meta'>,
  identity: Identity | null | undefined,
): 'allowed' | 'denied' {
  const entry = route.meta.navEntry
  if (entry && !canAccess(entry, identity)) return 'denied'
  const roles = route.meta.roles
  if (roles && (!identity || !roles.includes(identity.role))) return 'denied'
  const flags = route.meta.flags
  if (flags && identity?.role !== 'admin' && !flags.every((flag) => identity?.permissions[flag])) {
    return 'denied'
  }
  return 'allowed'
}

export function installGuards(router: Router, ctx: GuardContext): void {
  router.beforeEach(async (to) => {
    await ctx.ready?.()
    const session = await ctx.queryClient.fetchQuery(sessionQuery())
    const target = routeForState(session.state, to, router)
    if (target !== true) return target
    if (isSignedIn(session) && (isShellRoute(to) || !isSignInRoute(to))) {
      // FR-050: fetchQuery returns the cached identity unless it is older than its stale time.
      await ctx.queryClient.fetchQuery(identityQuery()).catch(() => undefined)
    }
    return true
  })
}
