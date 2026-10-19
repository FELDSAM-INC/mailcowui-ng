// T072: the throttling countdown (US1-AS6, research R13): from `retryAfter`, announced only at the
// start and when sign-in is possible again.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useThrottle } from '@/shared/composables/useThrottle'
import { liveMessages } from '@/shared/composables/useAnnouncer'

import { withSetup } from '../../support/composable'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useThrottle', () => {
  it('counts down from retryAfter and announces the start and the end only', async () => {
    const { result } = withSetup(() => useThrottle())
    expect(result.active.value).toBe(false)
    result.start(90)
    expect(result.active.value).toBe(true)
    await nextTick()
    expect(result.clock.value).toBe('1:30')
    await vi.advanceTimersByTimeAsync(60)
    expect(liveMessages.assertive.value).toBe(
      'Too many attempts. You can try again in 1 minute and 30 seconds.',
    )
    expect(liveMessages.polite.value).toBe('')

    await vi.advanceTimersByTimeAsync(45_000)
    expect(result.clock.value).toBe('0:45')
    expect(liveMessages.polite.value).toBe('')

    await vi.advanceTimersByTimeAsync(45_100)
    expect(result.active.value).toBe(false)
    expect(liveMessages.polite.value).toBe('You can try to sign in again.')
  })

  it('uses a minute when the server gives no retry time', async () => {
    const { result } = withSetup(() => useThrottle())
    result.start(null)
    await nextTick()
    expect(result.clock.value).toBe('1:00')
  })
})
