// Landing after a sign-in (UI 005 research R20, FR-031, FR-100): the one place where the app opens
// the validated `returnTo` or the home screen once a session is active, after every sign-in path
// (password, passkey, second-factor step, single sign-on, pending actions). Features register hooks
// that run first with the landing intent: `requested` when the sign-in started from an app address
// (a bookmark, a link, a session end) and `default` from the sign-in screen itself. A hook that
// navigated away (webmail forwarding) ends the landing; a failing hook is announced and the landing
// goes on as usual.
import type { RouteLocationRaw } from 'vue-router'

import { queryKeys, type Identity, type Session } from '@/api'
import { i18n } from '@/i18n'
import { announce } from '@/shared/composables/useAnnouncer'

import { acceptReturnTo } from '../router/return-to'
import { sessionContext } from './context'
import { cachedSession } from './queries'
import { rerouteCurrent } from './reroute'
import { useSessionStore, type LandingIntent } from './store'

export interface LandingContext {
  intent: LandingIntent
  session: Session
  identity: Identity | undefined
}

/** Resolves true when it navigated away (the landing ends), false to land as usual. */
export type LandingHook = (context: LandingContext) => Promise<boolean>

interface Registered {
  hook: LandingHook
  /** The new string announced when the hook fails. */
  failureKey?: string
}

const hooks: Registered[] = []

/** Registers a hook; returns its removal. */
export function registerLandingHook(
  hook: LandingHook,
  options: { failureKey?: string } = {},
): () => void {
  const entry: Registered = { hook, failureKey: options.failureKey }
  hooks.push(entry)
  return () => {
    const index = hooks.indexOf(entry)
    if (index >= 0) hooks.splice(index, 1)
  }
}

/**
 * Lands an active session: the hooks, then `target` when given (single sign-on's kept address),
 * otherwise the router guard's own landing (returnTo or home). A session that is not active is
 * routed by the guard (second-factor step, pending actions).
 */
export async function continueAfterSignIn(
  options: { target?: RouteLocationRaw } = {},
): Promise<void> {
  const ctx = sessionContext()
  const store = useSessionStore()
  const current = ctx.router.currentRoute.value
  const hasReturnTo =
    acceptReturnTo(current.query.returnTo, ctx.router) !== null ||
    acceptReturnTo(store.returnTo, ctx.router) !== null
  const intent: LandingIntent =
    store.landingIntent === 'requested' || hasReturnTo ? 'requested' : 'default'
  store.landingIntent = 'default'
  const session = cachedSession(ctx.queryClient)
  if (session?.state === 'active') {
    const identity = ctx.queryClient.getQueryData<Identity>(queryKeys.identity())
    for (const { hook, failureKey } of [...hooks]) {
      try {
        if (await hook({ intent, session, identity })) return
      } catch {
        if (failureKey) announce(i18n.global.t(failureKey), { assertive: true })
      }
    }
  }
  if (options.target) await ctx.router.replace(options.target)
  else await rerouteCurrent(ctx.router)
}
