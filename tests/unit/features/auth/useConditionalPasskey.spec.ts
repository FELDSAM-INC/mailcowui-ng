// T087: passkeys in the username autofill (FR-012, research R14): started on mount only when the
// browser offers conditional mediation, restarted before the challenge expires (when the page is
// visible), aborted on unmount, on a modal ceremony and on a password submit, and never a modal
// prompt. UI 001 fix (2026-10-19, iOS autofill): one request stays pending while the screen is
// shown. Focus, visibility, reconnects and session refetches never abort or restart it; it restarts
// when the browser settles it without a credential, with a growing delay when that happens at once.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { installGuards } from '@/app/router/guards'
import { setSessionContext } from '@/app/session/context'
import { sessionQuery } from '@/app/session/queries'
import * as authApi from '@/features/auth/api'
import { useConditionalPasskey } from '@/features/auth/composables/useConditionalPasskey'
import { createAppChannel } from '@/shared/platform/broadcast'
import { getAssertion } from '@/shared/platform/webauthn'

import { SEEDED_CREDENTIALS } from '../../../mocks/factories/webauthn'
import { mockState, useScenario } from '../../../mocks/node'
import { withSetup } from '../../support/composable'
import { testPlugins } from '../../support/mount'
import { createTestRouter } from '../../support/router'
import { credentialFor, installWebAuthn } from '../../support/webauthn-stub'

let webauthn: ReturnType<typeof installWebAuthn>
const signals: AbortSignal[] = []

/** A pending get() call, which the test settles as the browser would. */
interface HeldRequest {
  options: CredentialRequestOptions
  resolve: (credential: unknown) => void
  reject: (error: unknown) => void
}
const held: HeldRequest[] = []

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  useScenario('anonymous-default')
  signals.length = 0
  held.length = 0
})

const mounted: (() => void)[] = []

afterEach(() => {
  // Unmount every instance, so that no listener of an earlier test reacts to this one's events.
  for (const unmount of mounted.splice(0)) unmount()
  Reflect.deleteProperty(document, 'visibilityState')
  setSessionContext(null)
  vi.useRealTimers()
})

function pendingGet() {
  webauthn.get.mockImplementation(
    (options?: CredentialRequestOptions) =>
      new Promise((resolve, reject) => {
        if (options?.signal) signals.push(options.signal)
        held.push({ options: options!, resolve, reject })
        options?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        )
      }),
  )
}

/** Changes `document.visibilityState` and fires `visibilitychange`, as the iOS passkey sheet does. */
function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

async function mountConditional(available = true, options: { signedInFlow?: boolean } = {}) {
  webauthn = installWebAuthn({ conditional: available })
  pendingGet()
  const onError = vi.fn()
  const router = createTestRouter()
  if (options.signedInFlow) {
    // acceptSession needs the session context, and the guard routes after the sign-in.
    const { queryClient } = testPlugins()
    installGuards(router, { queryClient })
    setSessionContext({ queryClient, router, channel: createAppChannel('test') })
  }
  await router.push('/sign-in')
  const setup = withSetup(() => useConditionalPasskey({ role: () => null, onError }), { router })
  mounted.push(setup.unmount)
  return { ...setup, onError, router }
}

const challenges = () =>
  mockState().requests.filter((r) => r.operationId === 'createPasskeyChallenge').length

describe('useConditionalPasskey', () => {
  it('starts a conditional request on mount when the browser offers it', async () => {
    await mountConditional()
    await vi.waitFor(() => expect(webauthn.get).toHaveBeenCalledTimes(1))
    expect(webauthn.get.mock.calls[0]?.[0]?.mediation).toBe('conditional')
    expect(challenges()).toBe(1)
  })

  it('does nothing without conditional mediation', async () => {
    await mountConditional(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(webauthn.get).not.toHaveBeenCalled()
    expect(challenges()).toBe(0)
  })

  it('restarts 30 s before the challenge expires while the page is visible', async () => {
    await mountConditional()
    await vi.waitFor(() => expect(webauthn.get).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(260_000)
    expect(webauthn.get).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(15_000)
    await vi.waitFor(() => expect(webauthn.get).toHaveBeenCalledTimes(2))
    expect(signals[0]?.aborted).toBe(true)
    expect(webauthn.get.mock.calls.every((call) => call[0]?.mediation === 'conditional')).toBe(true)
  })

  it('restarts when the page becomes visible after the challenge ran out', async () => {
    await mountConditional()
    await vi.waitFor(() => expect(webauthn.get).toHaveBeenCalledTimes(1))
    vi.setSystemTime(Date.now() + 290_000)
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(webauthn.get).toHaveBeenCalledTimes(2))
  })

  it('aborts on unmount, on a modal ceremony and on stop()', async () => {
    const { unmount, result } = await mountConditional()
    mounted.pop()
    await vi.waitFor(() => expect(webauthn.get).toHaveBeenCalledTimes(1))
    webauthn.get.mockRejectedValueOnce(new DOMException('cancelled', 'NotAllowedError'))
    await getAssertion({
      challenge: 'Y2hhbGxlbmdl',
      rpId: 'localhost',
      allowCredentials: [],
      userVerification: 'required',
      timeout: 1,
    }).catch(() => undefined)
    expect(signals[0]?.aborted).toBe(true)

    result.start()
    await vi.waitFor(() => expect(signals).toHaveLength(2))
    result.stop()
    expect(signals[1]?.aborted).toBe(true)

    result.start()
    await vi.waitFor(() => expect(signals).toHaveLength(3))
    unmount()
    expect(signals[2]?.aborted).toBe(true)
  })

  it('restarts silently after an expired challenge and asks to choose the passkey again', async () => {
    webauthn = installWebAuthn()
    pendingGet()
    // The user picks a passkey after another page replaced the challenge.
    webauthn.get.mockImplementationOnce((options?: CredentialRequestOptions) => {
      const credential = credentialFor(SEEDED_CREDENTIALS.alice, options!)
      mockState().session.passkeyChallenge = null
      return Promise.resolve(credential)
    })
    const onError = vi.fn()
    const router = createTestRouter()
    await router.push('/sign-in')
    const { result, unmount } = withSetup(
      () => useConditionalPasskey({ role: () => null, onError }),
      { router },
    )
    mounted.push(unmount)
    await vi.waitFor(() => expect(result.chooseAgain.value).toBe(true))
    // The credential came at once, so the restart waits for the first retry delay.
    await vi.advanceTimersByTimeAsync(1_000)
    await vi.waitFor(() => expect(webauthn.get).toHaveBeenCalledTimes(2))
    expect(challenges()).toBe(2)
    expect(onError).not.toHaveBeenCalled()
  })

  it('reports a refused autofill passkey and keeps offering passkeys', async () => {
    webauthn = installWebAuthn()
    pendingGet()
    webauthn.get.mockImplementationOnce((options?: CredentialRequestOptions) =>
      Promise.resolve(credentialFor(SEEDED_CREDENTIALS.unknown, options!)),
    )
    const onError = vi.fn()
    const router = createTestRouter()
    await router.push('/sign-in')
    mounted.push(
      withSetup(() => useConditionalPasskey({ role: () => null, onError }), { router }).unmount,
    )
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
    expect(onError.mock.calls[0]?.[0]).toMatchObject({ status: 401 })
    await vi.advanceTimersByTimeAsync(1_000)
    await vi.waitFor(() => expect(webauthn.get).toHaveBeenCalledTimes(2))
  })

  it('restarts at once after a refused passkey the user took time to choose', async () => {
    const { onError } = await mountConditional()
    await vi.waitFor(() => expect(held).toHaveLength(1))
    await vi.advanceTimersByTimeAsync(10_000)
    held[0]!.resolve(credentialFor(SEEDED_CREDENTIALS.unknown, held[0]!.options))
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(held).toHaveLength(2))
  })

  it('backs off when an authenticator answers the autofill request by itself and is refused', async () => {
    webauthn = installWebAuthn()
    webauthn.get.mockImplementation((options?: CredentialRequestOptions) =>
      Promise.resolve(credentialFor(SEEDED_CREDENTIALS.unknown, options!)),
    )
    const onError = vi.fn()
    const router = createTestRouter()
    await router.push('/sign-in')
    mounted.push(
      withSetup(() => useConditionalPasskey({ role: () => null, onError }), { router }).unmount,
    )
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(webauthn.get.mock.calls.length).toBeLessThanOrEqual(4)
  })
})

describe('one pending request while the sign-in screen is shown (UI 001 fix, iOS autofill)', () => {
  const requested = (operationId: string) =>
    mockState().requests.filter((r) => r.operationId === operationId).length

  it('keeps the pending request through blur, focus, visibility changes, reconnects and session refetches', async () => {
    await mountConditional()
    await vi.waitFor(() => expect(held).toHaveLength(1))
    // The iOS passkey sheet: the page loses focus and visibility, then gets both back.
    window.dispatchEvent(new Event('blur'))
    setVisibility('hidden')
    window.dispatchEvent(new Event('pagehide'))
    setVisibility('visible')
    window.dispatchEvent(new Event('pageshow'))
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('online'))
    // A session refetch and an invalidation while signed out.
    const { queryClient } = testPlugins()
    await queryClient.fetchQuery({ ...sessionQuery(), staleTime: 0 })
    await queryClient.invalidateQueries()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(requested('getSession')).toBe(1)
    expect(webauthn.get).toHaveBeenCalledTimes(1)
    expect(signals[0]?.aborted).toBe(false)
    expect(challenges()).toBe(1)
  })

  it('does not restart when the page becomes visible while the first challenge is on its way', async () => {
    mockState().delays.createPasskeyChallenge = 1_000
    const { result } = await mountConditional()
    await vi.waitFor(() => expect(result.active.value).toBe(true))
    setVisibility('hidden')
    setVisibility('visible')
    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(held).toHaveLength(1))
    await vi.advanceTimersByTimeAsync(5_000)
    expect(challenges()).toBe(1)
    expect(webauthn.get).toHaveBeenCalledTimes(1)
    expect(signals[0]?.aborted).toBe(false)
  })

  it('submits a passkey chosen after the page lost and regained focus, and signs in', async () => {
    useScenario('passkey-user')
    const { router, onError } = await mountConditional(true, { signedInFlow: true })
    await vi.waitFor(() => expect(held).toHaveLength(1))
    window.dispatchEvent(new Event('blur'))
    setVisibility('hidden')
    setVisibility('visible')
    window.dispatchEvent(new Event('focus'))
    const request = held[0]!
    request.resolve(credentialFor(SEEDED_CREDENTIALS.alice, request.options))
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/'))
    expect(
      mockState()
        .requests.filter((r) => r.operationId === 'createSessionWithPasskey')
        .map((r) => r.status),
    ).toEqual([201])
    expect(challenges()).toBe(1)
    expect(onError).not.toHaveBeenCalled()
  })

  it('restarts a request the browser settles before a passkey is chosen (a dismissed prompt)', async () => {
    const { onError } = await mountConditional()
    await vi.waitFor(() => expect(held).toHaveLength(1))
    await vi.advanceTimersByTimeAsync(20_000)
    held[0]!.reject(new DOMException('The user dismissed the prompt.', 'NotAllowedError'))
    await vi.waitFor(() => expect(held).toHaveLength(2))
    expect(challenges()).toBe(2)
    expect(webauthn.get.mock.calls.every((call) => call[0]?.mediation === 'conditional')).toBe(true)
    expect(onError).not.toHaveBeenCalled()
  })

  it('restarts a request the browser aborted by itself', async () => {
    await mountConditional()
    await vi.waitFor(() => expect(held).toHaveLength(1))
    await vi.advanceTimersByTimeAsync(20_000)
    held[0]!.reject(new DOMException('The operation was aborted.', 'AbortError'))
    await vi.waitFor(() => expect(held).toHaveLength(2))
    expect(challenges()).toBe(2)
  })

  it('restarts with a growing delay when the browser refuses the request at once', async () => {
    webauthn = installWebAuthn()
    webauthn.get.mockRejectedValue(new DOMException('Not now.', 'NotAllowedError'))
    const router = createTestRouter()
    await router.push('/sign-in')
    mounted.push(
      withSetup(() => useConditionalPasskey({ role: () => null, onError: vi.fn() }), { router })
        .unmount,
    )
    await vi.waitFor(() => expect(webauthn.get).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(1_500)
    await vi.waitFor(() => expect(webauthn.get).toHaveBeenCalledTimes(2))
    await vi.advanceTimersByTimeAsync(3_000)
    expect(webauthn.get).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(3_000)
    await vi.waitFor(() => expect(webauthn.get).toHaveBeenCalledTimes(3))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(challenges()).toBeLessThanOrEqual(4)
  })

  it('retries a failed challenge request instead of leaving no request pending', async () => {
    mockState().failures.createPasskeyChallenge = { status: 500, times: 1 }
    await mountConditional()
    await vi.advanceTimersByTimeAsync(2_000)
    await vi.waitFor(() => expect(held).toHaveLength(1))
    expect(
      mockState()
        .requests.filter((r) => r.operationId === 'createPasskeyChallenge')
        .map((r) => r.status),
    ).toEqual([500, 200])
  })

  it('gives up when the browser cannot use passkeys here', async () => {
    webauthn = installWebAuthn()
    webauthn.get.mockRejectedValue(new DOMException('Not supported.', 'NotSupportedError'))
    const router = createTestRouter()
    await router.push('/sign-in')
    mounted.push(
      withSetup(() => useConditionalPasskey({ role: () => null, onError: vi.fn() }), { router })
        .unmount,
    )
    await vi.waitFor(() => expect(webauthn.get).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(120_000)
    expect(webauthn.get).toHaveBeenCalledTimes(1)
  })

  it('renews a challenge with a short lifetime halfway through it, without a restart loop', async () => {
    webauthn = installWebAuthn()
    pendingGet()
    const createChallenge = vi.spyOn(authApi, 'createPasskeyChallenge')
    createChallenge.mockImplementation(() =>
      Promise.resolve({
        challenge: {
          publicKey: {
            challenge: 'Y2hhbGxlbmdl',
            rpId: 'localhost',
            allowCredentials: [],
            userVerification: 'required',
            timeout: 300000,
          },
          expiresAt: new Date(Date.now() + 20_000).toISOString(),
        },
        skew: 0,
      }),
    )
    const router = createTestRouter()
    await router.push('/sign-in')
    mounted.push(
      withSetup(() => useConditionalPasskey({ role: () => null, onError: vi.fn() }), { router })
        .unmount,
    )
    await vi.waitFor(() => expect(held).toHaveLength(1))
    await vi.advanceTimersByTimeAsync(9_000)
    expect(held).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(2_000)
    await vi.waitFor(() => expect(held).toHaveLength(2))
    createChallenge.mockRestore()
  })

  it('defers a restart that falls due while the page is hidden until it is visible again', async () => {
    await mountConditional()
    await vi.waitFor(() => expect(held).toHaveLength(1))
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(280_000)
    expect(webauthn.get).toHaveBeenCalledTimes(1)
    expect(signals[0]?.aborted).toBe(false)
    setVisibility('visible')
    await vi.waitFor(() => expect(held).toHaveLength(2))
    expect(signals[0]?.aborted).toBe(true)
  })

  it('leaves the request to another ceremony that aborted it, which resumes it afterwards', async () => {
    const { result } = await mountConditional()
    await vi.waitFor(() => expect(held).toHaveLength(1))
    const modal = getAssertion({
      challenge: 'Y2hhbGxlbmdl',
      rpId: 'localhost',
      allowCredentials: [],
      userVerification: 'required',
      timeout: 1,
    }).catch(() => undefined)
    await vi.waitFor(() => expect(held).toHaveLength(2))
    expect(signals[0]?.aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(signals[1]?.aborted).toBe(false)
    held[1]!.reject(new DOMException('cancelled', 'NotAllowedError'))
    await modal
    await vi.advanceTimersByTimeAsync(5_000)
    expect(webauthn.get).toHaveBeenCalledTimes(2)
    expect(challenges()).toBe(1)
    result.start()
    await vi.waitFor(() => expect(held).toHaveLength(3))
  })

  it('does not start a request after the screen unmounted before the browser answered', async () => {
    webauthn = installWebAuthn()
    pendingGet()
    const router = createTestRouter()
    await router.push('/sign-in')
    const { unmount } = withSetup(
      () => useConditionalPasskey({ role: () => null, onError: vi.fn() }),
      { router },
    )
    unmount()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(webauthn.get).not.toHaveBeenCalled()
    expect(challenges()).toBe(0)
  })
})
