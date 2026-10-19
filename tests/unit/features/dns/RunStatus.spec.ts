// The diagnostics run state (T057, research R14, FR-058, FR-066, FR-069, FR-091): running with the
// time it can take, a timeout, a refusal for too many runs with the countdown, an error with the
// previous result kept, the runs left, and "Run again" disabled while running or blocked.
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiProblem } from '@/api'
import RunStatus from '@/features/dns/components/DiagnosticsRunStatus.vue'
import { DiagnosticsTimeout } from '@/features/dns/api/diagnostics'
import { liveMessages } from '@/shared/composables/useAnnouncer'

import { mountWithApp } from '../../support/mount'

const base = {
  running: false,
  error: null,
  rateLimit: undefined,
  runTimeoutSeconds: 30,
  hasResult: false,
}

describe('RunStatus', () => {
  beforeEach(() =>
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    }),
  )
  afterEach(() => vi.useRealTimers())

  it('shows the running state and blocks a second run', () => {
    const wrapper = mountWithApp(RunStatus, { props: { ...base, running: true } })
    expect(wrapper.get('[role="status"]').text()).toContain('can take up to 30 seconds')
    expect(wrapper.get('[data-run-again]').attributes('aria-disabled')).toBe('true')
    void wrapper.get('[data-run-again]').trigger('click')
    expect(wrapper.emitted('runAgain')).toBeUndefined()
  })

  it('explains a timeout and keeps the previous result', async () => {
    const wrapper = mountWithApp(RunStatus, {
      props: { ...base, error: new DiagnosticsTimeout(45), hasResult: true },
    })
    expect(wrapper.get('[role="alert"]').text()).toContain('longer than 45 seconds')
    expect(wrapper.text()).toContain('The result shown is from the previous check.')
    await wrapper.get('[data-run-again]').trigger('click')
    expect(wrapper.emitted('runAgain')).toHaveLength(1)
  })

  it('translates a server error', () => {
    const wrapper = mountWithApp(RunStatus, {
      props: { ...base, error: ApiProblem.fromParts({ kind: 'network' }) },
    })
    expect(wrapper.get('[role="alert"]').text()).toContain('The DNS records could not be checked.')
    expect(wrapper.text()).toContain('could not be reached')
  })

  it('counts down while no run is left and announces once when available again', async () => {
    const now = Date.now()
    const wrapper = mountWithApp(RunStatus, {
      props: {
        ...base,
        hasResult: true,
        error: ApiProblem.fromParts({
          kind: 'problem',
          status: 429,
          type: '/api/v2/problems/too-many-requests',
          retryAfter: 20,
        }),
        rateLimit: { limit: 10, remaining: 0, resetAt: now + 20_000 },
      },
    })
    expect(wrapper.text()).toContain('Too many attempts')
    expect(wrapper.text()).toContain('Available again in 20 seconds')
    expect(wrapper.get('[data-run-again]').attributes('aria-disabled')).toBe('true')
    vi.advanceTimersByTime(21_000)
    await flushPromises()
    vi.advanceTimersByTime(100)
    expect(liveMessages.polite.value).toBe('Checking DNS is available again.')
    expect(wrapper.get('[data-run-again]').attributes('aria-disabled')).toBeUndefined()
  })

  it('names the runs left from three down', () => {
    const wrapper = mountWithApp(RunStatus, {
      props: { ...base, rateLimit: { limit: 10, remaining: 3, resetAt: Date.now() + 30_000 } },
    })
    expect(wrapper.text()).toContain('Checks left this minute: 3')
    const plenty = mountWithApp(RunStatus, {
      props: { ...base, rateLimit: { limit: 10, remaining: 7, resetAt: Date.now() + 30_000 } },
    })
    expect(plenty.text()).not.toContain('Checks left')
  })
})
