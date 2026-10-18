// The inactivity limit of automatic polling (UI 008 T028, research R7, conventions "Polling"): the
// user's last interaction (pointer, keyboard, wheel, touch, scrolling on window, passive and
// throttled to once per second), idle after the limit, the limit `min(15 min, session idle
// timeout)`, and the listeners removed with the scope.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import {
  INACTIVITY_EVENTS,
  inactivityLimit,
  MAX_INACTIVITY_MS,
  useInactivity,
} from '@/shared/composables/useInactivity'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-19T08:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('inactivityLimit', () => {
  it('is the lower of 15 minutes and the session idle timeout', () => {
    expect(MAX_INACTIVITY_MS).toBe(15 * 60_000)
    expect(inactivityLimit(10_800)).toBe(15 * 60_000)
    expect(inactivityLimit(300)).toBe(300_000)
    expect(inactivityLimit(null)).toBe(15 * 60_000)
  })
})

describe('useInactivity', () => {
  it('listens passively on window for the interaction events and removes them', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const scope = effectScope()
    scope.run(() => useInactivity({ limit: 60_000 }))
    expect(INACTIVITY_EVENTS).toEqual(['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'])
    for (const name of INACTIVITY_EVENTS) {
      expect(add).toHaveBeenCalledWith(name, expect.any(Function), { passive: true })
    }
    scope.stop()
    for (const name of INACTIVITY_EVENTS) {
      expect(remove).toHaveBeenCalledWith(name, expect.any(Function))
    }
  })

  it('turns idle after the limit without interaction, and active again on interaction', async () => {
    const scope = effectScope()
    const state = scope.run(() => useInactivity({ limit: 60_000 }))!
    expect(state.idle.value).toBe(false)
    vi.advanceTimersByTime(59_000)
    window.dispatchEvent(new Event('keydown'))
    vi.advanceTimersByTime(59_000)
    expect(state.idle.value).toBe(false)
    vi.advanceTimersByTime(1_500)
    expect(state.idle.value).toBe(true)
    window.dispatchEvent(new Event('pointerdown'))
    await nextTick()
    expect(state.idle.value).toBe(false)
    scope.stop()
  })

  it('records an interaction at most once per second', () => {
    const scope = effectScope()
    const state = scope.run(() => useInactivity({ limit: 60_000 }))!
    const first = state.lastActivity.value
    vi.advanceTimersByTime(400)
    window.dispatchEvent(new Event('scroll'))
    expect(state.lastActivity.value).toBe(first)
    vi.advanceTimersByTime(700)
    window.dispatchEvent(new Event('wheel'))
    expect(state.lastActivity.value).toBe(first + 1_100)
    scope.stop()
  })

  it('follows a changing limit and can be reset by the caller', async () => {
    const limit = ref(60_000)
    const scope = effectScope()
    const state = scope.run(() => useInactivity({ limit }))!
    limit.value = 10_000
    await nextTick()
    vi.advanceTimersByTime(10_500)
    expect(state.idle.value).toBe(true)
    state.reset()
    expect(state.idle.value).toBe(false)
    scope.stop()
  })
})
