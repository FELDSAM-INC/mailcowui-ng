// Wires the session lifecycle into the app (research R8, R11, R12): the session-level reactions
// of the query and mutation caches, the client's session-ended signal, cross-tab messages, and
// the mirrors of the session in client state (idle lifetime, preferences saving).
import {
  onSessionEnded,
  queryKeys,
  setSessionReactions,
  setIdentityChangeHandler,
  type Identity,
  type Session,
} from '@/api'

import { usePreferencesStore } from '../preferences/store'
import { setSessionContext, type SessionContext } from './context'
import { connectCrossTab } from './cross-tab'
import { switchIdentity } from './identity-switch'
import { installIdleTimer } from './idle-timer'
import { registerLandingHook } from './landing'
import { identityQuery, sessionQuery } from './queries'
import { rerouteCurrent } from './reroute'
import { endSession } from './session-end'
import { useSessionStore } from './store'

export type { SessionContext } from './context'

async function refetchAndReroute(ctx: SessionContext, withIdentity: boolean): Promise<void> {
  try {
    await ctx.queryClient.fetchQuery({ ...sessionQuery(), staleTime: 0 })
    if (withIdentity) await ctx.queryClient.fetchQuery({ ...identityQuery(), staleTime: 0 })
  } catch {
    // The guard fetches again on the next navigation.
  }
  await rerouteCurrent(ctx.router)
}

export function installSession(ctx: SessionContext): () => void {
  setSessionContext(ctx)
  const store = useSessionStore()
  const preferences = usePreferencesStore()

  setIdentityChangeHandler({
    current: () => ctx.queryClient.getQueryData<Identity>(queryKeys.identity()),
    changed: ({ identity, refusedWrite }) =>
      switchIdentity({ reason: 'changedInAnotherTab', identity, refusedWrite }, ctx),
  })
  setSessionReactions({
    impersonationEnded: () => void switchIdentity({ reason: 'actingEndedByServer' }, ctx),
    unauthenticated: () => void endSession(ctx),
    secondFactorRequired: () => void refetchAndReroute(ctx, false),
    pendingActionRequired: () => void refetchAndReroute(ctx, true),
    forbidden: (problem) => {
      void ctx.queryClient.invalidateQueries({ queryKey: queryKeys.identity() })
      // UI 005 (research R6, FR-007): a withdrawn flag also changes what the self-service
      // capabilities allow, so sections become hidden or read-only.
      if (problem.is('permission-flag-required')) {
        void ctx.queryClient.invalidateQueries({ queryKey: queryKeys.capabilities.selfService() })
      }
    },
    // UI 012 (FR-052): the provider ended the single sign-on session.
    identityProviderSessionEnded: () => void endSession(ctx, { notice: 'ssoSessionEnded' }),
  })
  const offEnded = onSessionEnded(
    (reason) =>
      void endSession(
        ctx,
        reason === 'identityProviderSessionEnded' ? { notice: 'ssoSessionEnded' } : {},
      ),
  )
  const offCrossTab = connectCrossTab(ctx)
  const offIdle = installIdleTimer(ctx)
  const offWebmail = registerLandingHook(
    async (context) => {
      if (
        context.intent !== 'default' ||
        context.session.state !== 'active' ||
        context.session.role !== 'mailboxUser' ||
        context.session.pendingActions.length > 0 ||
        context.identity?.role !== 'mailboxUser' ||
        context.identity.pendingActions.length > 0 ||
        context.identity.impersonation
      )
        return false
      const { forwardAfterSignIn } = await import('@/features/account')
      return forwardAfterSignIn(context, ctx.queryClient)
    },
    { failureKey: 'account.webmail.failed' },
  )

  const mirror = (session: Session | undefined) => {
    if (!session) return
    store.idleTimeout = session.idleTimeout
    preferences.setSessionState(session.state)
  }
  mirror(ctx.queryClient.getQueryData(queryKeys.session()))
  const offMirror = ctx.queryClient.getQueryCache().subscribe((event) => {
    if (event.query.queryKey[0] !== queryKeys.session()[0]) return
    if (event.type === 'updated' && event.action.type === 'success') {
      mirror(event.action.data as Session)
    }
  })

  return () => {
    setSessionReactions(null)
    setIdentityChangeHandler(null)
    setSessionContext(null)
    offEnded()
    offCrossTab()
    offIdle()
    offWebmail()
    offMirror()
  }
}
