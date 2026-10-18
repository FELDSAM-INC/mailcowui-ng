// A countdown to an absolute server time (research R13). The skew between the device clock and
// the server clock comes from the HTTP Date header of the response that carried the deadline;
// the remaining time counts against `Date.now() + skew`. Milestones fire once each, and the time
// is recomputed on `visibilitychange`, because background tabs throttle timers.
import { computed, onScopeDispose, ref, watch } from 'vue'

/** Server time minus local receive time, in ms; 0 without a Date header. */
export function computeSkew(serverDate: Date | null | undefined, receivedAt: number = Date.now()) {
  if (!serverDate || Number.isNaN(serverDate.getTime())) return 0
  return serverDate.getTime() - receivedAt
}

type DeadlineValue = string | number | Date | null | undefined

export interface CountdownOptions {
  deadline: () => DeadlineValue
  /** Server clock minus device clock, in ms. */
  skew?: () => number
  /** Seconds remaining at which `onMilestone` fires, for example `[120, 60, 30]`. */
  milestones?: readonly number[]
  onMilestone?: (seconds: number) => void
  onExpire?: () => void
}

function toTime(value: DeadlineValue): number | null {
  if (value === null || value === undefined) return null
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

export function useCountdown(options: CountdownOptions) {
  const remaining = ref(0)
  const running = ref(false)
  const fired = new Set<number>()
  let expiredFired = false
  let timer: ReturnType<typeof setInterval> | null = null

  function recompute() {
    const deadline = toTime(options.deadline())
    if (deadline === null) {
      running.value = false
      remaining.value = 0
      return
    }
    running.value = true
    const now = Date.now() + (options.skew?.() ?? 0)
    remaining.value = Math.max(0, Math.ceil((deadline - now) / 1000))

    const due = (options.milestones ?? []).filter((m) => remaining.value <= m && !fired.has(m))
    if (due.length > 0 && remaining.value > 0) {
      for (const milestone of due) fired.add(milestone)
      options.onMilestone?.(Math.min(...due))
    }
    if (remaining.value === 0 && !expiredFired) {
      expiredFired = true
      stopTimer()
      options.onExpire?.()
    }
  }

  function stopTimer() {
    if (timer !== null) clearInterval(timer)
    timer = null
  }

  function start() {
    stopTimer()
    fired.clear()
    expiredFired = false
    recompute()
    if (running.value && !expiredFired) timer = setInterval(recompute, 1000)
  }

  const onVisibility = () => recompute()
  document.addEventListener('visibilitychange', onVisibility)

  watch(() => toTime(options.deadline()), start, { immediate: true })

  onScopeDispose(() => {
    stopTimer()
    document.removeEventListener('visibilitychange', onVisibility)
  })

  return {
    remaining,
    expired: computed(() => running.value && remaining.value === 0),
    restart: start,
    stop: stopTimer,
  }
}
