// Cross-tab coherence (FR-032, FR-037, research R12). Activity in any tab counts for the idle
// timer; a sign-in or a lifted restriction in another tab makes this tab refetch its session; a
// sign-out there ends the session here. As a fallback, an identity refresh that reports another
// account discards the previous account's data.
import { onActivity, queryKeys, type Identity } from '@/api'

import type { SessionContext } from './context'
import { identityQuery, isSignedIn, sessionQuery } from './queries'
import { rerouteCurrent } from './reroute'
import { endSession } from './session-end'
import { useSessionStore } from './store'

const isIdentityKey = (key: readonly unknown[]) => key[0] === queryKeys.identity()[0]

/** Clears the cache, refetches the session (and identity) and lets the guard re-route. */
export async function refreshAfterSessionChange(ctx: SessionContext): Promise<void> {
  ctx.queryClient.clear()
  try {
    const session = await ctx.queryClient.fetchQuery(sessionQuery())
    if (isSignedIn(session)) await ctx.queryClient.fetchQuery(identityQuery())
  } catch {
    // The next navigation fetches again; the guard handles the failure.
  }
  await rerouteCurrent(ctx.router)
}

/** Discards the previous account's data when an identity refresh reports another account. */
export function watchIdentityChanges(ctx: SessionContext): () => void {
  const cached = ctx.queryClient.getQueryData<Identity>(queryKeys.identity())
  let known: Pick<Identity, 'username' | 'role'> | null = cached
    ? { username: cached.username, role: cached.role }
    : null
  return ctx.queryClient.getQueryCache().subscribe((event) => {
    if (!isIdentityKey(event.query.queryKey)) return
    if (event.type === 'removed') {
      known = null
      return
    }
    if (event.type !== 'updated' || event.action.type !== 'success') return
    const next = event.action.data as Identity
    const changed = known && (known.username !== next.username || known.role !== next.role)
    known = { username: next.username, role: next.role }
    if (!changed) return
    ctx.queryClient.removeQueries({ predicate: (query) => !isIdentityKey(query.queryKey) })
    void ctx.queryClient
      .fetchQuery(sessionQuery())
      .catch(() => undefined)
      .then(() => rerouteCurrent(ctx.router))
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
