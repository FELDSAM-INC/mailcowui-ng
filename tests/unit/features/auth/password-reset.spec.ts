// The password reset (UI 005 T064, research R12, data-model §7): the token leaves the address in
// the global guard (query or fragment) and is read once; the reset page's state machine with the
// password rules before the second factor, the factor step, invalid and expired links, the
// administrator case, and the completion without session reactions ending this browser's session
// in place.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'

import { createQueryClient, queryKeys } from '@/api'
import { installGuards } from '@/app/router/guards'
import { setSessionContext } from '@/app/session/context'
import { sessionQuery } from '@/app/session/queries'
import { usePasswordReset } from '@/features/auth/composables/usePasswordReset'
import { captureResetToken, takeResetToken } from '@/features/auth/reset-token'
import { createAppChannel } from '@/shared/platform/broadcast'
import * as webauthn from '@/shared/platform/webauthn'

import { mockState, server, useScenario } from '../../../mocks/node'
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
  it('scrubs a second fragment link opened on the current reset route', async () => {
    useScenario('account-password-reset')
    const { router } = await context()
    await router.push(`/reset-password#token=${PLAIN}`)
    expect(router.currentRoute.value.fullPath).toBe('/reset-password')
    expect(takeResetToken()).toBe(PLAIN)
    await router.push(`/reset-password#token=${TOTP}`)
    expect(router.currentRoute.value.fullPath).toBe('/reset-password')
    expect(takeResetToken()).toBe(TOTP)
  })

  it.each([
    { query: {}, hash: '#token=%E0%A4%A' },
    { query: {}, hash: '#token=' },
    { query: { token: '' }, hash: '' },
    { query: { token: ['one', 'two'] }, hash: '' },
    { query: { token: 'x'.repeat(65) }, hash: '' },
  ])('removes an invalid token without throwing or retaining an earlier one (%#)', (link) => {
    hold('earlier-token')
    expect(captureResetToken({ path: '/reset-password', ...link } as never)).toEqual({
      path: '/reset-password',
      query: {},
      hash: '',
      replace: true,
      force: true,
    })
    expect(takeResetToken()).toBeNull()
  })

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
  it('shows a retryable error when the token check cannot reach the server', async () => {
    useScenario('account-password-reset')
    await context()
    hold(PLAIN)
    server.use(
      http.post('*/api/v2/password-resets/token-check', () => HttpResponse.error(), { once: true }),
    )
    const { result } = withSetup(() => usePasswordReset())
    await result.start()
    expect(result.state.value).toBe('error')
    expect(result.busy.value).toBe(false)
    expect(result.problem.value).not.toBeNull()
    expect(takeResetToken()).toBeNull()
    await result.retry()
    expect(result.state.value).toBe('password')
    expect(result.problem.value).toBeNull()
  })

  it('blocks another completion until the server retry time has elapsed', async () => {
    useScenario('account-password-reset')
    await context()
    hold(PLAIN)
    const { result } = withSetup(() => usePasswordReset())
    await result.start()
    mockState().selfService.resetAttempts.complete = 10
    await result.submitPassword('summer2026x')
    expect(result.problem.value?.is('too-many-requests')).toBe(true)
    expect(result.busy.value).toBe(true)
    const attempts = mockState().selfService.resetAttempts.complete
    await result.submitPassword('summer2026x')
    expect(mockState().selfService.resetAttempts.complete).toBe(attempts)
    const now = Date.now()
    const retryAfter = result.problem.value!.retryAfter!
    const date = vi.spyOn(Date, 'now').mockReturnValue(now + (retryAfter + 1) * 1000)
    await vi.waitFor(() => expect(result.busy.value).toBe(false), { timeout: 2000 })
    date.mockRestore()
    mockState().selfService.resetAttempts.complete = 0
    await result.submitPassword('summer2026x')
    expect(result.state.value).toBe('done')
  })

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
    const { queryClient } = await context()
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
    const caches = JSON.stringify([
      queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.state),
      queryClient
        .getMutationCache()
        .getAll()
        .map((mutation) => mutation.state),
    ])
    expect(caches).not.toContain(TOTP)
    expect(caches).not.toContain('summer2026x')
  })

  it('forgets an expired link while waiting for a WebAuthn challenge', async () => {
    useScenario('account-password-reset')
    await context()
    hold(TOTP)
    const { result } = withSetup(() => usePasswordReset())
    await result.start()
    await result.submitPassword('summer2026x')
    let release!: () => void
    let requested!: () => void
    const started = new Promise<void>((resolve) => {
      requested = resolve
    })
    const waiting = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.post('*/api/v2/password-resets/webauthn-challenge', async () => {
        requested()
        await waiting
        return HttpResponse.json({
          data: {
            publicKey: {
              challenge: 'Y2hhbGxlbmdl',
              rpId: 'localhost',
              userVerification: 'required',
            },
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        })
      }),
    )
    const get = vi
      .spyOn(webauthn, 'getAssertion')
      .mockRejectedValue(new DOMException('Cancelled', 'NotAllowedError'))
    const checking = result.submitWebAuthn()
    await started
    const date = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 16 * 60_000)
    await vi.waitFor(() => expect(result.state.value).toBe('invalid'), { timeout: 2000 })
    release()
    await checking
    date.mockRestore()
    expect(get).not.toHaveBeenCalled()
    expect(result.state.value).toBe('invalid')
  })

  it('cancels only its own authenticator prompt when the reset page closes', async () => {
    useScenario('account-password-reset')
    await context()
    hold(TOTP)
    const { result, unmount } = withSetup(() => usePasswordReset())
    await result.start()
    await result.submitPassword('summer2026x')
    server.use(
      http.post('*/api/v2/password-resets/webauthn-challenge', () =>
        HttpResponse.json({
          data: {
            publicKey: {
              challenge: 'Y2hhbGxlbmdl',
              rpId: 'localhost',
              userVerification: 'required',
            },
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        }),
      ),
    )
    let reject!: (reason: unknown) => void
    const get = vi.spyOn(webauthn, 'getAssertion').mockImplementation(
      () =>
        new Promise((_, fail) => {
          reject = fail
        }),
    )
    const abortAll = vi.spyOn(webauthn, 'abortCeremony')
    const assertion = result.submitWebAuthn()
    await vi.waitFor(() => expect(get).toHaveBeenCalledOnce())
    const signal = get.mock.calls[0]?.[1]?.signal
    unmount()
    reject(new DOMException('Cancelled', 'AbortError'))
    await assertion
    expect(signal?.aborted).toBe(true)
    expect(abortAll).not.toHaveBeenCalled()
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
