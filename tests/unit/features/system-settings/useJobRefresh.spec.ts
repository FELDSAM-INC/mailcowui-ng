import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { MassMailJobStatus } from '@/api'
import { useJobRefresh } from '@/features/system-settings/composables/useJobRefresh'

let visibility: DocumentVisibilityState = 'visible'
beforeEach(() => {
  vi.useFakeTimers()
  visibility = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})
function setup(idleTimeout = 60) {
  const status = ref<MassMailJobStatus>('running'),
    updatedAt = ref(Date.now())
  const refetch = vi.fn(async () => {}),
    finished = vi.fn(),
    announce = vi.fn()
  const scope = effectScope()
  const refresh = scope.run(() =>
    useJobRefresh({
      status: () => status.value,
      dataUpdatedAt: () => updatedAt.value,
      idleTimeout: () => idleTimeout,
      refetch,
      finished,
      announce,
    }),
  )!
  return { status, updatedAt, refetch, finished, announce, refresh, stop: () => scope.stop() }
}
describe('mass mail job refresh', () => {
  it('polls at five seconds only while active, visible and running; resumes visibly once', async () => {
    const s = setup()
    expect(s.refresh.interval.value).toBe(5000)
    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(s.refresh.interval.value).toBe(false)
    visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(s.refetch).toHaveBeenCalledTimes(1)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(s.refetch).toHaveBeenCalledTimes(1)
    s.refresh.pause()
    expect(s.refresh.interval.value).toBe(false)
    s.refresh.resume()
    expect(s.refetch).toHaveBeenCalledTimes(2)
    s.status.value = 'completed'
    await nextTick()
    expect(s.refresh.interval.value).toBe(false)
    expect(s.finished).toHaveBeenCalledTimes(1)
    s.updatedAt.value++
    await nextTick()
    expect(s.finished).toHaveBeenCalledTimes(1)
    s.stop()
  })
  it('latches inactivity until explicit resume and never keeps an unattended session alive', async () => {
    const s = setup(10)
    vi.advanceTimersByTime(10_001)
    await nextTick()
    expect(s.refresh.inactive.value).toBe(true)
    expect(s.refresh.interval.value).toBe(false)
    window.dispatchEvent(new Event('pointerdown'))
    await nextTick()
    expect(s.refresh.inactive.value).toBe(true)
    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(s.refetch).not.toHaveBeenCalled()
    s.refresh.resume()
    expect(s.refresh.interval.value).toBe(5000)
    s.stop()
  })
  it('throttles progress announcements to thirty seconds and announces completion once', async () => {
    const s = setup(600)
    vi.advanceTimersByTime(5000)
    s.updatedAt.value = Date.now()
    await nextTick()
    expect(s.announce).not.toHaveBeenCalled()
    vi.advanceTimersByTime(25_000)
    s.updatedAt.value = Date.now()
    await nextTick()
    expect(s.announce).toHaveBeenCalledTimes(1)
    s.status.value = 'cancelled'
    await nextTick()
    expect(s.announce).toHaveBeenCalledTimes(2)
    s.stop()
    document.dispatchEvent(new Event('visibilitychange'))
    expect(s.refetch).not.toHaveBeenCalled()
  })
})
