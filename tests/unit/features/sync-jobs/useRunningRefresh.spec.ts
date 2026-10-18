// The list's automatic refresh (UI 008 T028, research R7, FR-014): every 30 s only while a listed
// job runs, the page is visible, selection mode is off, the user has not paused it and the last
// interaction is younger than the inactivity limit; one refetch when the page becomes visible with
// old data; the inactivity notice, which stays until the user resumes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import type { SyncJob } from '@/api'
import {
  REFRESH_INTERVAL_MS,
  useRunningRefresh,
} from '@/features/sync-jobs/composables/useRunningRefresh'

import { mockSyncJob, syncJobView, finishedRun } from '../../../mocks/factories/sync-job'

const running = (value: boolean): SyncJob =>
  syncJobView(
    mockSyncJob({ id: 1, runStatus: { ...finishedRun('succeeded', 'EX_OK'), running: value } }),
  )

let visibility: DocumentVisibilityState = 'visible'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-19T08:00:00Z'))
  visibility = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function setup(overrides: { idleTimeout?: number } = {}) {
  const jobs = ref<SyncJob[]>([running(true)])
  const selecting = ref(false)
  const updatedAt = ref(Date.now())
  const refetch = vi.fn(() => Promise.resolve())
  const scope = effectScope()
  const refresh = scope.run(() =>
    useRunningRefresh({
      jobs: () => jobs.value,
      selecting: () => selecting.value,
      refetch,
      dataUpdatedAt: () => updatedAt.value,
      idleTimeout: () => overrides.idleTimeout ?? 10_800,
    }),
  )!
  return { jobs, selecting, updatedAt, refetch, refresh, stop: () => scope.stop() }
}

describe('useRunningRefresh', () => {
  it('refreshes every 30 s only while a listed job runs', () => {
    const { jobs, refresh, stop } = setup()
    expect(REFRESH_INTERVAL_MS).toBe(30_000)
    expect(refresh.hasRunning.value).toBe(true)
    expect(refresh.refetchInterval()).toBe(30_000)
    jobs.value = [running(false)]
    expect(refresh.hasRunning.value).toBe(false)
    expect(refresh.refetchInterval()).toBe(false)
    stop()
  })

  it('stops while the page is hidden or selection mode is on', () => {
    const { selecting, refresh, stop } = setup()
    visibility = 'hidden'
    expect(refresh.refetchInterval()).toBe(false)
    visibility = 'visible'
    selecting.value = true
    expect(refresh.refetchInterval()).toBe(false)
    expect(refresh.suspended.value).toBe(true)
    selecting.value = false
    expect(refresh.refetchInterval()).toBe(30_000)
    stop()
  })

  it('pauses and resumes on request, refetching at once on resume', () => {
    const { refresh, refetch, stop } = setup()
    refresh.pause()
    expect(refresh.paused.value).toBe(true)
    expect(refresh.refetchInterval()).toBe(false)
    refresh.resume()
    expect(refresh.paused.value).toBe(false)
    expect(refresh.refetchInterval()).toBe(30_000)
    expect(refetch).toHaveBeenCalledTimes(1)
    stop()
  })

  it('refetches once when the page becomes visible with data older than 30 s', () => {
    const { refetch, updatedAt, stop } = setup()
    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(refetch).not.toHaveBeenCalled()
    updatedAt.value = Date.now() - 31_000
    document.dispatchEvent(new Event('visibilitychange'))
    expect(refetch).toHaveBeenCalledTimes(1)
    stop()
  })

  it('pauses after the inactivity limit with a notice and does not resume by itself', async () => {
    const { refresh, stop } = setup({ idleTimeout: 300 })
    vi.advanceTimersByTime(300_500)
    await nextTick()
    expect(refresh.inactive.value).toBe(true)
    expect(refresh.refetchInterval()).toBe(false)
    window.dispatchEvent(new Event('pointerdown'))
    await nextTick()
    expect(refresh.inactive.value).toBe(true)
    refresh.resume()
    expect(refresh.inactive.value).toBe(false)
    expect(refresh.refetchInterval()).toBe(30_000)
    stop()
  })

  it('does not latch the inactivity notice while no job runs', async () => {
    const { jobs, refresh, stop } = setup()
    jobs.value = [running(false)]
    vi.advanceTimersByTime(15 * 60_000 + 500)
    await nextTick()
    expect(refresh.inactive.value).toBe(false)
    stop()
  })
})
