// T074: the idle warning (FR-032, FR-082, WCAG 2.2.1): an alert dialog that traps focus, counts
// down with announcements at 120, 60 and 30 seconds, and offers "Stay signed in" (one GET
// /session) and "Sign out".
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { queryKeys, type Session } from '@/api'
import IdleWarningDialog from '@/app/session/IdleWarningDialog.vue'
import { setSessionContext } from '@/app/session/context'
import { useSessionStore } from '@/app/session/store'
import { liveMessages } from '@/shared/composables/useAnnouncer'
import { createAppChannel } from '@/shared/platform/broadcast'

import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'
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

afterEach(() => {
  setSessionContext(null)
  vi.useRealTimers()
})

async function openWarning() {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  useScenario('admin-active', { idleTimeout: 600 })
  const router = createTestRouter()
  await router.push('/domains')
  const queryClient = testPlugins().queryClient
  queryClient.setQueryData(queryKeys.session(), active)
  setSessionContext({ queryClient, router, channel: createAppChannel('test') })
  const store = useSessionStore()
  store.idleTimeout = 600
  store.lastActivityAt = Date.now() - 480_000
  const wrapper = mountWithApp(IdleWarningDialog, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  store.idleWarningOpen = true
  await flushPromises()
  const dialog = () => document.querySelector<HTMLElement>('[role="alertdialog"]')
  await vi.waitFor(() => expect(dialog()).not.toBeNull())
  return { wrapper, store, router, dialog }
}

const button = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find(
    (b) => b.textContent?.trim() === name,
  )

describe('IdleWarningDialog', () => {
  it('is an alert dialog with the countdown, and focus is inside it', async () => {
    const { dialog } = await openWarning()
    expect(dialog()?.textContent).toContain('Your session is about to end')
    expect(dialog()?.textContent).toMatch(/signed out in 2:00|signed out in 1:59/)
    await vi.waitFor(() => expect(dialog()?.contains(document.activeElement)).toBe(true))
  })

  it('announces the remaining time at 120, 60 and 30 seconds', async () => {
    await openWarning()
    await vi.advanceTimersByTimeAsync(100)
    expect(liveMessages.assertive.value).toBe('2 minutes left before you are signed out.')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(liveMessages.assertive.value).toBe('2 minutes left before you are signed out.')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(liveMessages.assertive.value).toBe('1 minute left before you are signed out.')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(liveMessages.assertive.value).toBe('30 seconds left before you are signed out.')
  })

  it('"Stay signed in" reads the session once and closes the warning', async () => {
    const { store, dialog } = await openWarning()
    const before = mockState().requests.length
    button('Stay signed in')!.click()
    await vi.waitFor(() => expect(store.idleWarningOpen).toBe(false))
    const ops = mockState()
      .requests.slice(before)
      .map((r) => r.operationId)
    expect(ops).toEqual(['getSession'])
    await vi.waitFor(() => expect(dialog()).toBeNull())
  })

  it('"Stay signed in" ends the session when the server already has', async () => {
    const { store, router } = await openWarning()
    mockState().session.state = 'anonymous'
    button('Stay signed in')!.click()
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('sign-in'))
    expect(store.notice).toBe('sessionEnded')
  })

  it('"Sign out" signs out', async () => {
    const { router } = await openWarning()
    button('Sign out')!.click()
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('sign-in'))
    expect(mockState().requests.some((r) => r.operationId === 'deleteSession')).toBe(true)
    expect(useSessionStore().notice).toBe('signedOut')
  })
})
