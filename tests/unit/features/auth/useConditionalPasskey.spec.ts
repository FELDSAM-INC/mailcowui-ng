// T087: passkeys in the username autofill (FR-012, research R14): started on mount only when the
// browser offers conditional mediation, restarted before the challenge expires and when the page
// becomes visible again, aborted on unmount, on a modal ceremony and on a password submit, and
// never a modal prompt.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useConditionalPasskey } from '@/features/auth/composables/useConditionalPasskey'
import { getAssertion } from '@/shared/platform/webauthn'

import { SEEDED_CREDENTIALS } from '../../../mocks/factories/webauthn'
import { mockState, useScenario } from '../../../mocks/node'
import { withSetup } from '../../support/composable'
import { createTestRouter } from '../../support/router'
import { credentialFor, installWebAuthn } from '../../support/webauthn-stub'

let webauthn: ReturnType<typeof installWebAuthn>
const signals: AbortSignal[] = []

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  useScenario('anonymous-default')
  signals.length = 0
})

const mounted: (() => void)[] = []

afterEach(() => {
  // Unmount every instance, so that no listener of an earlier test reacts to this one's events.
  for (const unmount of mounted.splice(0)) unmount()
  vi.useRealTimers()
})

function pendingGet() {
  webauthn.get.mockImplementation(
    (options?: CredentialRequestOptions) =>
      new Promise((_resolve, reject) => {
        if (options?.signal) signals.push(options.signal)
        options?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        )
      }),
  )
}

async function mountConditional(available = true) {
  webauthn = installWebAuthn({ conditional: available })
  pendingGet()
  const onError = vi.fn()
  const router = createTestRouter()
  await router.push('/sign-in')
  const setup = withSetup(() => useConditionalPasskey({ role: () => null, onError }), { router })
  mounted.push(setup.unmount)
  return { ...setup, onError }
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
    await vi.waitFor(() => expect(webauthn.get).toHaveBeenCalledTimes(2))
    expect(challenges()).toBe(2)
    expect(result.chooseAgain.value).toBe(true)
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
    await vi.waitFor(() => expect(webauthn.get).toHaveBeenCalledTimes(2))
  })
})
