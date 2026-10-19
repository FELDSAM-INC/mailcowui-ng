// UI 011 (research R5, data-model §7, T018): the live-update controller. Only `running` gives the
// live queries an interval; hiding the page, pausing, inactivity and missing capabilities stop it;
// showing the page again and resuming refetch the live queries at once.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { MonitoringCapabilities } from '@/api'
import { useLiveUpdates } from '@/features/operations/live/useLiveUpdates'

import { defaultMonitoringCapabilities } from '../../../../mocks/scenarios/operations/state'
import { withSetup } from '../../../support/composable'
import { testPlugins } from '../../../support/mount'

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  Object.defineProperty(document, 'hidden', { value: state === 'hidden', configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

function setup(
  options: { capabilities?: MonitoringCapabilities | null; idleTimeout?: number } = {},
) {
  const capabilities = ref<MonitoringCapabilities | null>(
    options.capabilities === undefined ? defaultMonitoringCapabilities() : options.capabilities,
  )
  const unavailable = ref(false)
  const refetch = vi.spyOn(testPlugins().queryClient, 'refetchQueries').mockResolvedValue()
  const mounted = withSetup(() =>
    useLiveUpdates({
      capabilities: () => capabilities.value,
      unavailable: () => unavailable.value,
      idleTimeout: () => options.idleTimeout ?? 10_800,
    }),
  )
  return { ...mounted, capabilities, unavailable, refetch }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-19T08:00:00Z'))
  setVisibility('visible')
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  setVisibility('visible')
})

describe('useLiveUpdates', () => {
  it('runs with the intervals of the capabilities', () => {
    const { result } = setup()
    expect(result.state.value).toBe('running')
    expect(result.interval('host')).toBe(5000)
    expect(result.interval('containers')).toBe(5000)
    expect(result.interval('resourceUsage')).toBe(5000)
    expect(result.interval('mailStorage')).toBe(60_000)
  })

  it('gives no interval before the capabilities are read, and none when they fail', async () => {
    const { result, unavailable, capabilities } = setup({ capabilities: null })
    expect(result.interval('host')).toBe(false)
    unavailable.value = true
    await nextTick()
    expect(result.state.value).toBe('unavailable')
    capabilities.value = defaultMonitoringCapabilities()
    unavailable.value = false
    await nextTick()
    expect(result.state.value).toBe('running')
  })

  it('stops while the page is hidden and refetches the live queries at once when shown', async () => {
    const { result, refetch } = setup()
    setVisibility('hidden')
    await nextTick()
    expect(result.state.value).toBe('hidden')
    expect(result.interval('host')).toBe(false)
    expect(refetch).not.toHaveBeenCalled()
    setVisibility('visible')
    await nextTick()
    expect(result.state.value).toBe('running')
    expect(refetch).toHaveBeenCalledWith({ queryKey: ['monitoring', 'live'], type: 'active' })
  })

  it('pauses with the time it paused, and resumes with an immediate refetch', async () => {
    const { result, refetch } = setup()
    vi.setSystemTime(new Date('2026-10-19T08:01:00Z'))
    result.pause()
    await nextTick()
    expect(result.state.value).toBe('paused')
    expect(result.since.value).toBe(Date.parse('2026-10-19T08:01:00Z'))
    expect(result.interval('host')).toBe(false)
    setVisibility('hidden')
    setVisibility('visible')
    await nextTick()
    expect(refetch).not.toHaveBeenCalled()
    result.resume()
    await nextTick()
    expect(result.state.value).toBe('running')
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('pauses after the inactivity limit and stays paused until resumed', async () => {
    const { result } = setup({ idleTimeout: 300 })
    vi.advanceTimersByTime(299_000)
    await nextTick()
    expect(result.state.value).toBe('running')
    vi.advanceTimersByTime(2_000)
    await nextTick()
    expect(result.state.value).toBe('inactive')
    window.dispatchEvent(new Event('pointerdown'))
    await nextTick()
    expect(result.state.value).toBe('inactive')
    result.resume()
    await nextTick()
    expect(result.state.value).toBe('running')
  })

  it('counts an interaction as activity and limits to 15 minutes', async () => {
    const { result } = setup()
    vi.advanceTimersByTime(10 * 60_000)
    window.dispatchEvent(new Event('keydown'))
    vi.advanceTimersByTime(10 * 60_000)
    await nextTick()
    expect(result.state.value).toBe('running')
    vi.advanceTimersByTime(6 * 60_000)
    await nextTick()
    expect(result.state.value).toBe('inactive')
  })

  it('ends the inactivity pause on a manual refresh', async () => {
    const { result } = setup({ idleTimeout: 60 })
    vi.advanceTimersByTime(61_000)
    await nextTick()
    expect(result.state.value).toBe('inactive')
    result.noteManualRefresh()
    await nextTick()
    expect(result.state.value).toBe('running')
  })

  it('removes its listeners when the page unmounts', () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    const { unmount } = setup()
    unmount()
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })
})
