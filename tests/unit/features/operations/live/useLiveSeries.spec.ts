// UI 011 (research R7, data-model §2, T020): a live series keeps the last 30 samples collected
// while it is shown, appends a sample only when its collection time changes, and is gone with its
// scope.
import { describe, expect, it } from 'vitest'
import { effectScope } from 'vue'

import { SERIES_LENGTH, useLiveSeries } from '@/features/operations/live/useLiveSeries'

describe('useLiveSeries', () => {
  it('keeps at most 30 samples, the newest last', () => {
    const series = useLiveSeries(2)
    for (let i = 0; i < 35; i += 1) {
      series.push(new Date(Date.UTC(2026, 9, 19, 8, 0, i)).toISOString(), [i, i * 2])
    }
    expect(SERIES_LENGTH).toBe(30)
    expect(series.samples.value).toHaveLength(30)
    expect(series.samples.value[0]!.values).toEqual([5, 10])
    expect(series.samples.value.at(-1)!.values).toEqual([34, 68])
  })

  it('does not append a sample with an unchanged time', () => {
    const series = useLiveSeries(1)
    series.push('2026-10-19T08:00:00Z', [1])
    series.push('2026-10-19T08:00:00Z', [2])
    expect(series.samples.value).toEqual([{ t: '2026-10-19T08:00:00Z', values: [1] }])
  })

  it('keeps null values (rates before the second sample)', () => {
    const series = useLiveSeries(2)
    series.push('2026-10-19T08:00:00Z', [null, null])
    expect(series.samples.value[0]!.values).toEqual([null, null])
  })

  it('is cleared with its scope and by reset', () => {
    const scope = effectScope()
    const series = scope.run(() => useLiveSeries(1))!
    series.push('2026-10-19T08:00:00Z', [1])
    series.reset()
    expect(series.samples.value).toEqual([])
    series.push('2026-10-19T08:00:05Z', [1])
    scope.stop()
    expect(series.samples.value).toEqual([])
  })
})
