// The idle timer (FR-032, FR-033, research R12). The deadline is the last API response in any tab
// plus the server's idle lifetime. The warning opens 2 minutes before it; at the deadline the
// session ends locally without a request, because the server has already ended it. The timer
// runs only while the session is active or restricted, sends nothing by itself, and is
// recomputed on every activity and on `visibilitychange`, because background tabs throttle timers.
import { watch } from 'vue'

import { queryKeys, type Session } from '@/api'

import type { SessionContext } from './context'
import { cachedSession, isSignedIn } from './queries'
import { endSession } from './session-end'
import { useSessionStore } from './store'

/** The warning opens this many seconds before the idle deadline. */
export const IDLE_WARNING_SECONDS = 120

/** Epoch ms at which the server ends an idle session. */
export function idleDeadline(lastActivityAt: number, idleTimeout: number): number {
  return lastActivityAt + idleTimeout * 1000
}

export function installIdleTimer(ctx: SessionContext): () => void {
  const store = useSessionStore()
  let warnTimer: ReturnType<typeof setTimeout> | null = null
  let expireTimer: ReturnType<typeof setTimeout> | null = null

  function clear() {
    if (warnTimer !== null) clearTimeout(warnTimer)
    if (expireTimer !== null) clearTimeout(expireTimer)
    warnTimer = expireTimer = null
  }

  function expire() {
    clear()
    store.idleWarningOpen = false
    void endSession(ctx, { broadcast: true })
  }

  function schedule() {
    clear()
    if (!isSignedIn(cachedSession(ctx.queryClient))) {
      store.idleWarningOpen = false
      return
    }
    const deadline = idleDeadline(store.lastActivityAt, store.idleTimeout)
    const now = Date.now()
    if (deadline <= now) {
      expire()
      return
    }
    const warnAt = deadline - IDLE_WARNING_SECONDS * 1000
    if (warnAt <= now) store.idleWarningOpen = true
    else warnTimer = setTimeout(() => (store.idleWarningOpen = true), warnAt - now)
    expireTimer = setTimeout(expire, deadline - now)
  }

  const stopWatch = watch([() => store.lastActivityAt, () => store.idleTimeout], schedule)
  const offCache = ctx.queryClient.getQueryCache().subscribe((event) => {
    if (event.query.queryKey[0] !== queryKeys.session()[0]) return
    if (event.type === 'updated' || event.type === 'removed') {
      const state = (event.query.state.data as Session | undefined)?.state
      if (event.type === 'removed' || state !== undefined) schedule()
    }
  })
  const onVisibility = () => schedule()
  document.addEventListener('visibilitychange', onVisibility)
  schedule()

  return () => {
    clear()
    stopWatch()
    offCache()
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
