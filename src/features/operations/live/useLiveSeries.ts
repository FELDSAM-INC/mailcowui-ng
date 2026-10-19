// A live chart's series (research R7, data-model §2): a ring buffer of the last 30 samples
// collected while the chart is shown (about 2.5 minutes at 5 seconds, as legacy keeps), appended
// only when the sample's collection time changes, because shared collection can return one sample
// to two polls. It lives in memory only and is dropped with its scope (the dashboard, or an
// expanded container's panel).
import { getCurrentScope, onScopeDispose, readonly, shallowRef } from 'vue'

export const SERIES_LENGTH = 30

export interface LiveSample {
  /** The collection time (`collectedAt` or `sampledAt`). */
  t: string
  /** One value per series; `null` while a rate needs a second sample. */
  values: (number | null)[]
}

export function useLiveSeries(seriesCount: number) {
  const samples = shallowRef<readonly LiveSample[]>([])

  function reset() {
    samples.value = []
  }

  if (getCurrentScope()) onScopeDispose(reset)

  return {
    seriesCount,
    samples: readonly(samples),
    push(t: string, values: (number | null)[]) {
      if (samples.value.at(-1)?.t === t) return
      samples.value = [...samples.value, { t, values: [...values] }].slice(-SERIES_LENGTH)
    },
    reset,
  }
}
