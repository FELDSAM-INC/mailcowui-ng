// Countdowns against the server clock (research R13): skew from the Date header, remaining time
// against Date.now() + skew, milestone callbacks, and recomputation on visibilitychange.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

import { computeSkew, useCountdown } from '@/shared/composables/useCountdown'

const START = Date.parse('2026-10-18T12:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START)
})

afterEach(() => {
  vi.useRealTimers()
})

function run<T>(factory: () => T) {
  const scope = effectScope()
  const result = scope.run(factory) as T
  return { result, stop: () => scope.stop() }
}

describe('computeSkew', () => {
  it('is the server Date minus the local receive time', () => {
    expect(computeSkew(new Date(START + 90_000), START)).toBe(90_000)
    expect(computeSkew(new Date(START - 5_000), START)).toBe(-5_000)
    expect(computeSkew(null, START)).toBe(0)
  })
})

describe('useCountdown', () => {
  it('counts down against the server clock', () => {
    // The device clock is two minutes behind the server.
    const skew = 120_000
    const deadline = new Date(START + skew + 300_000).toISOString()
    const { result, stop } = run(() => useCountdown({ deadline: () => deadline, skew: () => skew }))
    expect(result.remaining.value).toBe(300)
    vi.advanceTimersByTime(10_000)
    expect(result.remaining.value).toBe(290)
    stop()
  })

  it('fires milestones once and expires at zero', () => {
    const onMilestone = vi.fn()
    const onExpire = vi.fn()
    const { result, stop } = run(() =>
      useCountdown({
        deadline: () => START + 125_000,
        milestones: [120, 60, 30],
        onMilestone,
        onExpire,
      }),
    )
    expect(onMilestone).not.toHaveBeenCalled()
    vi.advanceTimersByTime(5_000)
    expect(onMilestone).toHaveBeenLastCalledWith(120)
    vi.advanceTimersByTime(65_000)
    expect(onMilestone).toHaveBeenLastCalledWith(60)
    vi.advanceTimersByTime(30_000)
    expect(onMilestone).toHaveBeenLastCalledWith(30)
    expect(onMilestone).toHaveBeenCalledTimes(3)
    vi.advanceTimersByTime(30_000)
    expect(result.remaining.value).toBe(0)
    expect(result.expired.value).toBe(true)
    expect(onExpire).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(10_000)
    expect(onExpire).toHaveBeenCalledTimes(1)
    stop()
  })

  it('fires only the nearest milestone already passed when it starts', () => {
    const onMilestone = vi.fn()
    const { stop } = run(() =>
      useCountdown({ deadline: () => START + 25_000, milestones: [120, 60, 30], onMilestone }),
    )
    expect(onMilestone).toHaveBeenCalledTimes(1)
    expect(onMilestone).toHaveBeenCalledWith(30)
    stop()
  })

  it('recomputes on visibilitychange, because background timers are throttled', () => {
    const { result, stop } = run(() => useCountdown({ deadline: () => START + 600_000 }))
    // Time passes while no timer runs (a throttled background tab).
    vi.setSystemTime(START + 200_000)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(result.remaining.value).toBe(400)
    stop()
  })

  it('follows a changed deadline and stops on scope disposal', () => {
    const deadline = ref<number | null>(START + 60_000)
    const { result, stop } = run(() => useCountdown({ deadline: () => deadline.value }))
    expect(result.remaining.value).toBe(60)
    deadline.value = START + 120_000
    vi.advanceTimersByTime(1_000)
    expect(result.remaining.value).toBe(119)
    deadline.value = null
    vi.advanceTimersByTime(1_000)
    expect(result.remaining.value).toBe(0)
    expect(result.expired.value).toBe(false)
    stop()
    expect(vi.getTimerCount()).toBe(0)
  })
})
