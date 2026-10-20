// Cross-tab coherence (FR-032, FR-037, research R12). Activity in any tab counts for the idle
// timer; a sign-in or a lifted restriction in another tab makes this tab refetch its session; a
// sign-out there ends the session here. As a fallback, an identity refresh that reports another
// account discards the previous account's data.
import { onActivity, queryKeys, identityKey, problemOf, type Identity } from '@/api'
import { setDraftOwner } from '@/shared/composables/draft-registry'

import type { SessionContext } from './context'
import { fetchIdentity, sessionQuery } from './queries'
import { rerouteCurrent } from './reroute'
import { endSession } from './session-end'
import { useSessionStore } from './store'
import { switchIdentity } from './identity-switch'

const isIdentityKey = (key: readonly unknown[]) => key[0] === queryKeys.identity()[0]

/** Clears the cache, refetches the session (and identity) and lets the guard re-route. */
export async function refreshAfterSessionChange(ctx: SessionContext): Promise<void> {
  if (useSessionStore().identityTransition) return
  const previous = ctx.queryClient.getQueryData<Identity>(queryKeys.identity())
  try {
    // Read outside the cache so a changed identity cannot repaint the mounted old screen first.
    const identity = await fetchIdentity()
    if (identityKey(identity) !== identityKey(previous)) {
      await switchIdentity({ reason: 'changedInAnotherTab', identity }, ctx)
      return
    }
    ctx.queryClient.setQueryData(queryKeys.identity(), identity)
    await ctx.queryClient.fetchQuery({ ...sessionQuery(), staleTime: 0 })
    await rerouteCurrent(ctx.router)
  } catch (error) {
    if (problemOf(error)?.status === 401) await endSession(ctx)
  }
}

/** A refresh can change the acting instance even when username and role are unchanged. */
export function watchIdentityChanges(ctx: SessionContext): () => void {
  let known = identityKey(ctx.queryClient.getQueryData<Identity>(queryKeys.identity()))
  return ctx.queryClient.getQueryCache().subscribe((event) => {
    if (!isIdentityKey(event.query.queryKey)) return
    if (event.type === 'removed') {
      known = null
      return
    }
    if (event.type !== 'updated' || event.action.type !== 'success') return
    const next = event.action.data as Identity
    const key = identityKey(next)
    const changed = known !== null && known !== key
    known = key
    if (useSessionStore().identityTransition) return
    if (changed) void switchIdentity({ reason: 'changedInAnotherTab', identity: next }, ctx)
    else setDraftOwner(next.username)
  })
}

export function connectCrossTab(ctx: SessionContext): () => void {
  const store = useSessionStore()
  const offActivity = onActivity((at) => {
    store.recordActivity(at)
    ctx.channel.post({ v: 1, type: 'activity', at })
  })
  const offChannel = ctx.channel.subscribe((message) => {
    switch (message.type) {
      case 'activity':
        store.recordActivity(message.at)
        break
      case 'session-changed':
        void refreshAfterSessionChange(ctx)
        break
      case 'signed-out':
        void endSession(ctx)
        break
    }
  })
  const offIdentity = watchIdentityChanges(ctx)
  return () => {
    offActivity()
    offChannel()
    offIdentity()
  }
}
