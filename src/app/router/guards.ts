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
  switch (state) {
    case 'anonymous':
      if (to.meta.access === 'anonymous' || to.meta.access === 'public') return true
      return sendTo(router, 'sign-in', carriedReturnTo(to, router))
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
      return { path: target ?? '/', replace: true }
    }
  }
}

/** Whether the identity may use the route's section (FR-045). */
export function routeAccess(
  route: Pick<RouteLocationNormalizedGeneric, 'meta'>,
  identity: Identity | null | undefined,
): 'allowed' | 'denied' {
  const entry = route.meta.navEntry
  if (!entry) return 'allowed'
  return canAccess(entry, identity) ? 'allowed' : 'denied'
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
