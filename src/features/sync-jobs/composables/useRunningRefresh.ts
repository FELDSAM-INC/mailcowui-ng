// The list's automatic refresh while a job runs (UI 008 research R7, FR-014, conventions
// "Polling"). The list query's `refetchInterval` is 30 s only while all of these hold, and false
// otherwise:
//   1. a job on the current page is running;
//   2. the page is visible (TanStack skips intervals in the background with
//      `refetchIntervalInBackground: false`; becoming visible refetches once when the data is older
//      than the interval);
//   3. selection mode is off (a bulk action sends the versions as listed);
//   4. the user has not paused it (WCAG 2.2.2);
//   5. the last interaction is younger than `min(15 min, session idle timeout)` (`useInactivity`).
// When 5 fails while a job runs, refreshing stays paused with a notice until the user resumes it
// (or refreshes by hand): it never resumes on its own. Automatic refreshes announce nothing.
import { computed, onScopeDispose, ref, watch } from 'vue'

import type { SyncJob } from '@/api'
import { announce } from '@/shared/composables/useAnnouncer'
import { inactivityLimit, useInactivity } from '@/shared/composables/useInactivity'

export const REFRESH_INTERVAL_MS = 30_000

export interface RunningRefreshOptions {
  /** The jobs of the current page. */
  jobs: () => readonly SyncJob[]
  selecting: () => boolean
  refetch: () => Promise<unknown>
  /** When the list data was last updated (epoch ms). */
  dataUpdatedAt: () => number
  /** The session's idle timeout in seconds. */
  idleTimeout: () => number | null | undefined
  /** The notice announced when refreshing pauses for inactivity (a translated text). */
  inactivityNotice?: () => string
}

export function useRunningRefresh(options: RunningRefreshOptions) {
  const paused = ref(false)
  const inactive = ref(false)
  const activity = useInactivity({ limit: () => inactivityLimit(options.idleTimeout()) })

  const hasRunning = computed(() => options.jobs().some((job) => job.runStatus.running))
  const suspended = computed(() => options.selecting())
  const visible = () => document.visibilityState !== 'hidden'

  function canRefresh(): boolean {
    return (
      hasRunning.value &&
      visible() &&
      !options.selecting() &&
      !paused.value &&
      !inactive.value &&
      !activity.idle.value
    )
  }

  watch(
    () => activity.idle.value && hasRunning.value && !paused.value,
    (latch) => {
      if (!latch || inactive.value) return
      inactive.value = true
      const notice = options.inactivityNotice?.()
      if (notice) announce(notice)
    },
  )

  function onVisibility() {
    if (!canRefresh()) return
    if (Date.now() - options.dataUpdatedAt() > REFRESH_INTERVAL_MS) void options.refetch()
  }
  document.addEventListener('visibilitychange', onVisibility)
  onScopeDispose(() => document.removeEventListener('visibilitychange', onVisibility))

  return {
    hasRunning,
    suspended,
    paused,
    /** Paused because of inactivity: a notice with "Resume" is shown. */
    inactive,
    /** True while the list refreshes itself. */
    refreshing: computed(
      () => hasRunning.value && !paused.value && !inactive.value && !options.selecting(),
    ),
    /** For the list query's `refetchInterval`. */
    refetchInterval: (): number | false => (canRefresh() ? REFRESH_INTERVAL_MS : false),
    pause() {
      paused.value = true
    },
    /** Resumes after a pause or after inactivity, and refreshes at once. */
    resume() {
      paused.value = false
      inactive.value = false
      activity.reset()
      void options.refetch()
    },
    /** A manual refresh also ends the inactivity pause. */
    noteManualRefresh() {
      inactive.value = false
      activity.reset()
    },
  }
}
