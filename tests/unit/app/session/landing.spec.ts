// Landing after a sign-in (UI 005 T022, research R20, FR-100): one place opens the validated
// returnTo or home, after the registered hooks (webmail forwarding) had their turn with the
// current intent. The intent resets afterwards; a failing hook lands normally with a notice; a hook
// that navigated away ends the landing.
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createQueryClient, queryKeys, type Session } from '@/api'
import { installGuards } from '@/app/router/guards'
import { setSessionContext } from '@/app/session/context'
import { continueAfterSignIn, registerLandingHook } from '@/app/session/landing'
import { useSessionStore } from '@/app/session/store'
import * as announcer from '@/shared/composables/useAnnouncer'
import { createAppChannel } from '@/shared/platform/broadcast'

import { useScenario } from '../../../mocks/node'
import { createTestRouter } from '../../support/router'

const active: Session = {
  state: 'active',
  username: 'anna@example.org',
  role: 'mailboxUser',
  authMethod: 'password',
  signedInAt: '2026-10-19T08:00:00Z',
  pendingActions: [],
  idleTimeout: 10_800,
}

let off: (() => void)[] = []

afterEach(() => {
  for (const fn of off) fn()
  off = []
  setSessionContext(null)
})

async function setup(path: string) {
  // Signed out while the sign-in screen opens; the sign-in then makes the session active.
  useScenario('anonymous-default')
  const queryClient = createQueryClient({ retryDelay: 0 })
  const router = createTestRouter()
  installGuards(router, { queryClient })
  setSessionContext({ queryClient, router, channel: createAppChannel() })
  await router.push(path)
  queryClient.setQueryData(queryKeys.session(), active)
  return { queryClient, router }
}

describe('continueAfterSignIn', () => {
  it('opens the validated returnTo, or home', async () => {
    const { router } = await setup('/sign-in?returnTo=%2Fapi-keys')
    await continueAfterSignIn()
    expect(router.currentRoute.value.fullPath).toBe('/api-keys')
    const second = await setup('/sign-in')
    await continueAfterSignIn()
    expect(second.router.currentRoute.value.name).toBe('home')
  })

  it('runs the hooks first with the current intent and resets the intent', async () => {
    const { router } = await setup('/sign-in')
    const store = useSessionStore()
    store.landingIntent = 'requested'
    const hook = vi.fn(() => Promise.resolve(false))
    off.push(registerLandingHook(hook))
    await continueAfterSignIn()
    expect(hook).toHaveBeenCalledWith(expect.objectContaining({ intent: 'requested' }))
    expect(store.landingIntent).toBe('default')
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('treats a sign-in with a returnTo as requested', async () => {
    await setup('/sign-in?returnTo=%2Fapi-keys')
    const hook = vi.fn(() => Promise.resolve(false))
    off.push(registerLandingHook(hook))
    await continueAfterSignIn()
    expect(hook).toHaveBeenCalledWith(expect.objectContaining({ intent: 'requested' }))
  })

  it('stops when a hook navigated away', async () => {
    const { router } = await setup('/sign-in')
    off.push(registerLandingHook(() => Promise.resolve(true)))
    const replace = vi.spyOn(router, 'replace')
    await continueAfterSignIn()
    expect(replace).not.toHaveBeenCalled()
  })

  it('lands normally with an announced notice when a hook fails', async () => {
    const { router } = await setup('/sign-in')
    const announce = vi.spyOn(announcer, 'announce')
    off.push(registerLandingHook(() => Promise.reject(new Error('x')), { failureKey: 'nav.home' }))
    await continueAfterSignIn()
    expect(announce).toHaveBeenCalled()
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('skips the hooks for a session that is not active', async () => {
    const { queryClient } = await setup('/sign-in')
    queryClient.setQueryData(queryKeys.session(), { ...active, state: 'restricted' })
    const hook = vi.fn(() => Promise.resolve(false))
    off.push(registerLandingHook(hook))
    await continueAfterSignIn()
    expect(hook).not.toHaveBeenCalled()
  })
})
