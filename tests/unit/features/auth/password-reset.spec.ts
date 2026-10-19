// The password reset (UI 005 T064, research R12, data-model §7): the token leaves the address in
// `beforeEnter` (query or fragment) and is read once; the reset page's state machine with the
// password rules before the second factor, the factor step, invalid and expired links, the
// administrator case, and the completion without session reactions ending this browser's session
// in place.
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createQueryClient, queryKeys } from '@/api'
import { installGuards } from '@/app/router/guards'
import { setSessionContext } from '@/app/session/context'
import { sessionQuery } from '@/app/session/queries'
import { usePasswordReset } from '@/features/auth/composables/usePasswordReset'
import { captureResetToken, takeResetToken } from '@/features/auth/reset-token'
import { createAppChannel } from '@/shared/platform/broadcast'

import { mockState, useScenario } from '../../../mocks/node'
import { withSetup } from '../../support/composable'
import { createTestRouter } from '../../support/router'

const PLAIN = '3F9A1C-0B7E22-9D4F10-A6C3E8-51B2D7'
const TOTP = '7B21D0-55AE19-C0FFEE-12AB34-9E8D7C'

afterEach(() => {
  takeResetToken()
  setSessionContext(null)
})

async function context() {
  const queryClient = createQueryClient({ retryDelay: 0 })
  const router = createTestRouter()
  installGuards(router, { queryClient })
  setSessionContext({ queryClient, router, channel: createAppChannel('t') })
  await router.push('/reset-password/request')
  await queryClient.fetchQuery(sessionQuery())
  return { queryClient, router }
}

function hold(token: string) {
  captureResetToken({ path: '/reset-password', query: { token }, hash: '' } as never)
}

describe('captureResetToken', () => {
  it('moves the token from the query or the fragment into the holder and clears the address', () => {
    const fromQuery = captureResetToken({
      path: '/reset-password',
      query: { token: 'abc' },
      hash: '',
    } as never)
    expect(fromQuery).toEqual({
      path: '/reset-password',
      query: {},
      hash: '',
      replace: true,
      force: true,
    })
    expect(takeResetToken()).toBe('abc')
    expect(takeResetToken()).toBeNull()
    captureResetToken({ path: '/reset-password', query: {}, hash: '#token=xyz' } as never)
    expect(takeResetToken()).toBe('xyz')
    expect(captureResetToken({ path: '/reset-password', query: {}, hash: '' } as never)).toBe(true)
  })
})

describe('usePasswordReset', () => {
  it('resets an account without a second factor', async () => {
    useScenario('account-password-reset')
    await context()
    hold(PLAIN)
    const { result } = withSetup(() => usePasswordReset())
    await result.start()
    expect(result.state.value).toBe('password')
    await result.submitPassword('x')
    expect(result.state.value).toBe('password')
    expect(result.problem.value?.fieldErrors.has('newPassword')).toBe(true)
    await result.submitPassword('summer2026x')
    expect(result.state.value).toBe('done')
  })

  it('asks for the second factor after the password, and allows another try', async () => {
    useScenario('account-password-reset')
    await context()
    hold(TOTP)
    const { result } = withSetup(() => usePasswordReset())
    await result.start()
    await result.submitPassword('summer2026x')
    expect(result.state.value).toBe('factor')
    expect(result.methods.value.map((method) => method.type)).toEqual(['totp'])
    await result.submitFactor({ type: 'totp', methodId: 11, code: '000000' })
    expect(result.state.value).toBe('factor')
    expect(result.problem.value?.is('second-factor-failed')).toBe(true)
    await result.submitFactor({ type: 'totp', methodId: 11, code: '123456' })
    expect(result.state.value).toBe('done')
    const bodies = mockState().requests.filter((r) => r.operationId === 'completePasswordReset')
    expect(bodies.every((r) => JSON.stringify(r.body).includes('[redacted]'))).toBe(true)
  })

  it('shows the invalid state for missing, expired and used tokens', async () => {
    useScenario('account-password-reset')
    await context()
    const { result } = withSetup(() => usePasswordReset())
    await result.start()
    expect(result.state.value).toBe('invalid')
    hold('000000-EXPIRED-000000-000000-000000')
    await result.start()
    expect(result.state.value).toBe('invalid')
  })

  it('tells an account with only deprecated factors to ask an administrator', async () => {
    useScenario('account-password-reset')
    await context()
    hold('222222-U2FONLY-222222-222222-22222')
    const { result } = withSetup(() => usePasswordReset())
    await result.start()
    expect(result.state.value).toBe('askAdministrator')
  })

  it('warns a signed-in browser and ends its session in place after the reset (FR-042)', async () => {
    useScenario('account-password-reset-signed-in')
    const { queryClient, router } = await context()
    hold('333333-ANNA00-333333-333333-333333')
    const { result } = withSetup(() => usePasswordReset())
    await result.start()
    expect(result.state.value).toBe('warning')
    expect(result.signedInAs.value).toBe('anna@example.org')
    result.proceed()
    const path = router.currentRoute.value.fullPath
    await result.submitPassword('summer2026x')
    expect(result.state.value).toBe('done')
    await vi.waitFor(() =>
      expect(queryClient.getQueryData(queryKeys.session())).toMatchObject({ state: 'anonymous' }),
    )
    expect(router.currentRoute.value.fullPath).toBe(path)
  })
})
