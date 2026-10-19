// The live-update controller of a polling screen (research R5, data-model §7, conventions
// "Polling"). Only the state `running` gives the live queries (`['monitoring', 'live', …]`) an
// interval; every other state stops them:
//   - `hidden`: the page is hidden (FR-019); showing it refetches the live queries at once;
//   - `paused`: the user paused live updates (FR-020, WCAG 2.2.2); "Resume" refetches at once;
//   - `inactive`: no interaction for `min(15 min, session idle timeout)` (FR-021); it stays paused
//     until the user resumes or refreshes by hand, because polling renews the session;
//   - `unavailable`: the monitoring capabilities could not be read (FR-018): nothing polls.
// The controller and its listeners live as long as the calling page (leaving it stops everything).
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, readonly, ref, watch } from 'vue'

import { queryKeys, type MonitoringCapabilities } from '@/api'
import { inactivityLimit, useInactivity } from '@/shared/composables/useInactivity'

import { intervalSeconds, type LiveKind } from '../capabilities'

export type LiveState = 'running' | 'hidden' | 'paused' | 'inactive' | 'unavailable'

export interface LiveUpdatesOptions {
  capabilities: () => MonitoringCapabilities | null
  /** True when the capabilities read failed. */
  unavailable: () => boolean
  /** The session's idle timeout in seconds. */
  idleTimeout: () => number | null | undefined
}

export function useLiveUpdates(options: LiveUpdatesOptions) {
  const queryClient = useQueryClient()
  const hidden = ref(document.visibilityState === 'hidden')
  const paused = ref(false)
  const inactive = ref(false)
  const activity = useInactivity({ limit: () => inactivityLimit(options.idleTimeout()) })

  const state = computed<LiveState>(() => {
    if (options.unavailable()) return 'unavailable'
    if (hidden.value) return 'hidden'
    if (paused.value) return 'paused'
    if (inactive.value) return 'inactive'
    return 'running'
  })

  const since = ref(Date.now())
  watch(state, () => {
    since.value = Date.now()
  })

  // Inactivity latches: an interaction after the limit does not resume on its own.
  watch(
    () => activity.idle.value,
    (idle) => {
      if (idle && state.value === 'running') inactive.value = true
    },
  )

  function refreshNow() {
    return queryClient.refetchQueries({ queryKey: queryKeys.monitoring.live(), type: 'active' })
  }

  function onVisibility() {
    const nowHidden = document.visibilityState === 'hidden'
    if (nowHidden === hidden.value) return
    hidden.value = nowHidden
    if (!nowHidden && state.value === 'running') void refreshNow()
  }
  document.addEventListener('visibilitychange', onVisibility)
  onScopeDispose(() => document.removeEventListener('visibilitychange', onVisibility))

  return {
    state,
    /** When the state last changed (epoch ms), for "paused since". */
    since: readonly(since),
    /** The `refetchInterval` of a kind: milliseconds while running, otherwise false. */
    interval(kind: LiveKind): number | false {
      const capabilities = options.capabilities()
      if (state.value !== 'running' || !capabilities) return false
      return intervalSeconds(capabilities, kind) * 1000
    },
    pause() {
      paused.value = true
    },
    /** Resumes after a pause or after inactivity, and refetches at once (FR-020). */
    resume() {
      paused.value = false
      inactive.value = false
      activity.reset()
      if (state.value === 'running') void refreshNow()
    },
    /** A manual refresh works in every state and ends an inactivity pause. */
    noteManualRefresh() {
      inactive.value = false
      activity.reset()
    },
    refreshNow,
  }
}
