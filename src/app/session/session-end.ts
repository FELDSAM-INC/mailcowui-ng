// The end of a session (FR-034, research R11): an `unauthenticated` answer, a refused token
// replay, an idle expiry, or another tab's sign-out. The account's data is discarded, the sign-in
// screen explains what happened, the current page is kept for after the next sign-in, and a new
// anti-forgery token is fetched for the new anonymous session.
import { clearCsrfToken, queryKeys, refreshCsrfToken } from '@/api'
import { invalidateSessionScope } from '@/api/session-scope'

import { markSessionEnded } from '@/shared/composables/draft-registry'

import { acceptReturnTo } from '../router/return-to'
import { isAuthFlowRoute } from '../router/route-kinds'
import type { SessionContext } from './context'
import { anonymousSession, cachedSession } from './queries'
import { useSessionStore, type SessionNotice } from './store'

export type { SessionContext } from './context'

let ending: Promise<void> | null = null

export interface EndSessionOptions {
  broadcast?: boolean
  /** UI 012: the notice of the sign-in screen; `sessionEnded` by default. */
  notice?: SessionNotice
  /**
   * UI 005 (research R12): stay on the current page (the completed password reset, which ended
   * this browser's session): the clean-up runs, but there is no redirect and no notice.
   */
  stay?: boolean
}

/** Ends the session locally. Concurrent calls share one run. */
export function endSession(ctx: SessionContext, options: EndSessionOptions = {}): Promise<void> {
  ending ??= run(ctx, options).finally(() => {
    ending = null
  })
  return ending
}

async function run(ctx: SessionContext, options: EndSessionOptions): Promise<void> {
  const session = cachedSession(ctx.queryClient)
  if (session?.state === 'anonymous') return
  invalidateSessionScope()

  // UI 004 (research R10): forms that unmount now keep their input for the same account.
  markSessionEnded()
  const store = useSessionStore()
  const current = ctx.router.currentRoute.value
  const returnTo = isAuthFlowRoute(current) ? null : acceptReturnTo(current.fullPath, ctx.router)

  ctx.queryClient.clear()
  ctx.queryClient.setQueryData(
    queryKeys.session(),
    anonymousSession(session?.idleTimeout ?? store.idleTimeout),
  )
  store.reset()
  if (!options.stay) {
    store.returnTo = returnTo
    // UI 005 (FR-100): signing in again after a session end is never forwarded to webmail.
    store.landingIntent = 'requested'
    store.notice = options.notice ?? 'sessionEnded'
  }
  if (options.broadcast) ctx.channel.post({ v: 1, type: 'signed-out' })

  if (!options.stay) await goToSignIn(ctx, returnTo)
  clearCsrfToken()
  await refreshCsrfToken().catch(() => undefined)
}

/** Replaces the route with the sign-in screen (until US1 registers it, the guard decides). */
export async function goToSignIn(ctx: SessionContext, returnTo: string | null): Promise<void> {
  if (ctx.router.hasRoute('sign-in')) {
    await ctx.router.replace({ name: 'sign-in', query: returnTo ? { returnTo } : {} })
  } else {
    await ctx.router.replace({ path: ctx.router.currentRoute.value.fullPath, force: true })
  }
}
