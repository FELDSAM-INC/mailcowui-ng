// Wires the session lifecycle into the app (research R8, R11, R12): the session-level reactions
// of the query and mutation caches, the client's session-ended signal, cross-tab messages, and
// the mirrors of the session in client state (idle lifetime, preferences saving).
import { onSessionEnded, queryKeys, setSessionReactions, type Session } from '@/api'

import { usePreferencesStore } from '../preferences/store'
import { setSessionContext, type SessionContext } from './context'
import { connectCrossTab } from './cross-tab'
import { installIdleTimer } from './idle-timer'
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

  setSessionReactions({
    unauthenticated: () => void endSession(ctx),
    secondFactorRequired: () => void refetchAndReroute(ctx, false),
    pendingActionRequired: () => void refetchAndReroute(ctx, true),
    forbidden: () => void ctx.queryClient.invalidateQueries({ queryKey: queryKeys.identity() }),
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
    setSessionContext(null)
    offEnded()
    offCrossTab()
    offIdle()
    offMirror()
  }
}
