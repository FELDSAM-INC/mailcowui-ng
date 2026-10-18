// The inactivity limit of automatic polling (conventions "Polling", UI 008 research R7, reused by
// UI 011). Automatic requests renew the server's idle timer, so a screen that polls must stop once
// the user has been away for the lower of 15 minutes and the session's idle timeout (UI 001
// FR-033): otherwise polling would keep an idle session alive.
//
//   const { idle, lastActivity, reset } = useInactivity({ limit: () => inactivityLimit(timeout) })
//
// - `idle` turns true when no interaction happened for `limit` milliseconds, and false again on the
//   next interaction. A caller that must not resume on its own latches it (UI 008's refresh does).
// - Interactions are `pointerdown`, `keydown`, `wheel`, `touchstart` and `scroll` on `window`,
//   listened to passively and recorded at most once per second.
// - `reset()` counts as an interaction, for example a "Resume" action.
// - The listeners and the timer are removed with the calling scope (component unmount).
import { onScopeDispose, readonly, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'

/** The longest inactivity limit: 15 minutes. */
export const MAX_INACTIVITY_MS = 15 * 60_000

export const INACTIVITY_EVENTS = [
  'pointerdown',
  'keydown',
  'wheel',
  'touchstart',
  'scroll',
] as const

const THROTTLE_MS = 1_000

/** `min(15 min, idle timeout)`; the session's idle timeout is in seconds (`Session.idleTimeout`). */
export function inactivityLimit(idleTimeoutSeconds: number | null | undefined): number {
  if (!idleTimeoutSeconds || idleTimeoutSeconds <= 0) return MAX_INACTIVITY_MS
  return Math.min(MAX_INACTIVITY_MS, idleTimeoutSeconds * 1000)
}

export interface InactivityOptions {
  /** Milliseconds without interaction after which `idle` turns true. */
  limit: MaybeRefOrGetter<number>
}

export interface Inactivity {
  /** True after `limit` milliseconds without interaction. */
  idle: Readonly<Ref<boolean>>
  /** Epoch milliseconds of the last recorded interaction. */
  lastActivity: Readonly<Ref<number>>
  /** Records an interaction now. */
  reset(): void
}

export function useInactivity(options: InactivityOptions): Inactivity {
  const idle = ref(false)
  const lastActivity = ref(Date.now())
  let timer: ReturnType<typeof setTimeout> | null = null

  function schedule() {
    if (timer !== null) clearTimeout(timer)
    const remaining = lastActivity.value + toValue(options.limit) - Date.now()
    if (remaining <= 0) {
      idle.value = true
      timer = null
      return
    }
    idle.value = false
    timer = setTimeout(schedule, remaining)
  }

  function record() {
    lastActivity.value = Date.now()
    schedule()
  }

  function onInteraction() {
    if (Date.now() - lastActivity.value < THROTTLE_MS && !idle.value) return
    record()
  }

  for (const name of INACTIVITY_EVENTS) {
    window.addEventListener(name, onInteraction, { passive: true })
  }
  watch(() => toValue(options.limit), schedule)
  schedule()

  onScopeDispose(() => {
    for (const name of INACTIVITY_EVENTS) window.removeEventListener(name, onInteraction)
    if (timer !== null) clearTimeout(timer)
  })

  return { idle: readonly(idle), lastActivity: readonly(lastActivity), reset: record }
}
