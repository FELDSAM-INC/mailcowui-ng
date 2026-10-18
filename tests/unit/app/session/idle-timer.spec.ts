// T074: the idle timer (FR-032, FR-033, research R12): the deadline is the last activity in any
// tab plus the server's idle lifetime, the warning comes 2 minutes before it, and the expiry ends
// the session locally without asking the server.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createQueryClient, queryKeys, type Session } from '@/api'
import { idleDeadline, IDLE_WARNING_SECONDS, installIdleTimer } from '@/app/session/idle-timer'
import { installSession } from '@/app/session'
import { useSessionStore } from '@/app/session/store'
import { createAppChannel } from '@/shared/platform/broadcast'

import { mockState, useScenario } from '../../../mocks/node'
import { installBroadcastChannel } from '../../support/broadcast'
import { createTestRouter } from '../../support/router'

const active: Session = {
  state: 'active',
  username: 'admin',
  role: 'admin',
  authMethod: 'password',
  signedInAt: '2026-10-18T08:00:00Z',
  pendingActions: [],
  idleTimeout: 600,
}

let stop: (() => void) | null = null

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  })
})

afterEach(() => {
  stop?.()
  stop = null
  vi.useRealTimers()
})

async function setup(session: Session = active) {
  useScenario('admin-active', { idleTimeout: session.idleTimeout })
  const queryClient = createQueryClient({ retryDelay: 0 })
  const router = createTestRouter()
  await router.push('/domains')
  queryClient.setQueryData(queryKeys.session(), session)
  const store = useSessionStore()
  store.idleTimeout = session.idleTimeout
  store.lastActivityAt = Date.now()
  const ctx = { queryClient, router, channel: createAppChannel('idle-test') }
  stop = installIdleTimer(ctx)
  return { ctx, store, queryClient, router }
}

describe('idleDeadline', () => {
  it('is the last activity plus the idle lifetime', () => {
    expect(idleDeadline(1_000, 600)).toBe(601_000)
    expect(IDLE_WARNING_SECONDS).toBe(120)
  })
})

describe('installIdleTimer', () => {
  it('opens the warning 120 s before the deadline, not earlier', async () => {
    const { store } = await setup()
    await vi.advanceTimersByTimeAsync(479_000)
    expect(store.idleWarningOpen).toBe(false)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(store.idleWarningOpen).toBe(true)
  })

  it('restarts from new activity and closes the warning', async () => {
    const { store } = await setup()
    await vi.advanceTimersByTimeAsync(480_000)
    expect(store.idleWarningOpen).toBe(true)
    store.recordActivity(Date.now())
    await vi.advanceTimersByTimeAsync(0)
    expect(store.idleWarningOpen).toBe(false)
    await vi.advanceTimersByTimeAsync(479_000)
    expect(store.idleWarningOpen).toBe(false)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(store.idleWarningOpen).toBe(true)
  })

  it('recomputes on visibilitychange after a throttled background timer', async () => {
    const { store } = await setup()
    vi.setSystemTime(Date.now() + 500_000)
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(store.idleWarningOpen).toBe(true)
  })

  it('ends the session at the deadline without reading the session or identity', async () => {
    const { store, queryClient, router } = await setup()
    const before = mockState().requests.length
    await vi.advanceTimersByTimeAsync(600_000)
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('sign-in'))
    expect(queryClient.getQueryData<Session>(queryKeys.session())?.state).toBe('anonymous')
    expect(store.notice).toBe('sessionEnded')
    expect(store.idleWarningOpen).toBe(false)
    const ops = mockState()
      .requests.slice(before)
      .map((r) => r.operationId)
    expect(ops).not.toContain('getSession')
    expect(ops).not.toContain('getIdentity')
  })

  it('does nothing while nobody is signed in', async () => {
    const { store } = await setup({ ...active, state: 'anonymous' })
    await vi.advanceTimersByTimeAsync(700_000)
    expect(store.idleWarningOpen).toBe(false)
    expect(store.notice).toBeNull()
  })
})

describe('activity in other tabs (FR-032)', () => {
  it('resets the timer when another tab reports activity', async () => {
    const tabs = installBroadcastChannel()
    useScenario('admin-active', { idleTimeout: 600 })
    const queryClient = createQueryClient({ retryDelay: 0 })
    const router = createTestRouter()
    await router.push('/domains')
    queryClient.setQueryData(queryKeys.session(), active)
    stop = installSession({ queryClient, router, channel: createAppChannel() })
    const store = useSessionStore()
    store.lastActivityAt = Date.now()
    await vi.advanceTimersByTimeAsync(400_000)
    tabs.remote().channel.postMessage({ v: 1, type: 'activity', at: Date.now() })
    await vi.advanceTimersByTimeAsync(400_000)
    expect(store.idleWarningOpen).toBe(false)
    await vi.advanceTimersByTimeAsync(80_000)
    expect(store.idleWarningOpen).toBe(true)
  })
})
