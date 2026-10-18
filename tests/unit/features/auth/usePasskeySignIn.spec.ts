// T087: modal passkey sign-in (FR-011, FR-013, FR-014, research R14).
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { installGuards } from '@/app/router/guards'
import { setSessionContext } from '@/app/session/context'
import { usePasskeySignIn } from '@/features/auth/composables/usePasskeySignIn'
import { createAppChannel } from '@/shared/platform/broadcast'
import { getAssertion } from '@/shared/platform/webauthn'

import { SEEDED_CREDENTIALS } from '../../../mocks/factories/webauthn'
import { mockState, useScenario } from '../../../mocks/node'
import { withSetup } from '../../support/composable'
import { testPlugins } from '../../support/mount'
import { createTestRouter } from '../../support/router'
import { credentialFor, installWebAuthn } from '../../support/webauthn-stub'

afterEach(() => {
  setSessionContext(null)
})

async function setup(role: 'admin' | 'domainAdmin' | 'mailboxUser' | null = null) {
  const router = createTestRouter()
  const queryClient = testPlugins().queryClient
  installGuards(router, { queryClient })
  setSessionContext({ queryClient, router, channel: createAppChannel('test') })
  await router.push('/sign-in')
  const { result } = withSetup(() => usePasskeySignIn({ role: () => role }), { router })
  return { result, router }
}

/** navigator.credentials.get answering with a credential for the request's challenge. */
function answerWith(webauthn: ReturnType<typeof installWebAuthn>, credentialId: string) {
  webauthn.get.mockImplementation((options?: CredentialRequestOptions) =>
    Promise.resolve(credentialFor(credentialId, options!)),
  )
}

describe('usePasskeySignIn', () => {
  it('requests a challenge, asks the device and signs in with the role of the screen', async () => {
    useScenario('anonymous-default', {
      accounts: {
        reseller: {
          passkeys: [
            {
              id: 'a'.repeat(64),
              name: 'Key',
              authenticatorDescription: null,
              registeredAt: '2026-10-01T10:00:00Z',
              hostName: 'localhost',
              active: true,
              etag: '"pk"',
              credentialId: SEEDED_CREDENTIALS.admin,
            },
          ],
        },
      },
    })
    const webauthn = installWebAuthn()
    answerWith(webauthn, SEEDED_CREDENTIALS.admin)
    const { result, router } = await setup('domainAdmin')
    await result.signIn()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/'))
    const ops = mockState().requests.map((r) => r.operationId)
    expect(ops).toEqual(
      expect.arrayContaining(['createPasskeyChallenge', 'createSessionWithPasskey']),
    )
    const attempt = mockState().requests.find((r) => r.operationId === 'createSessionWithPasskey')
    expect(attempt?.body).toMatchObject({ role: 'domainAdmin' })
    expect(webauthn.get.mock.calls[0]?.[0]?.mediation).toBeUndefined()
  })

  it('aborts a running conditional request first', async () => {
    useScenario('anonymous-default')
    const webauthn = installWebAuthn()
    webauthn.get.mockImplementationOnce(
      (options?: CredentialRequestOptions) =>
        new Promise((_resolve, reject) =>
          options?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          ),
        ),
    )
    const conditional = getAssertion(
      {
        challenge: 'Y2hhbGxlbmdl',
        rpId: 'localhost',
        allowCredentials: [],
        userVerification: 'required',
        timeout: 1,
      },
      { mediation: 'conditional' },
    ).catch((error: unknown) => error)
    webauthn.get.mockRejectedValueOnce(new DOMException('cancelled', 'NotAllowedError'))
    const { result } = await setup()
    await result.signIn()
    expect(await conditional).toMatchObject({ kind: 'aborted' })
  })

  it.each([
    ['NotAllowedError', null],
    ['AbortError', null],
    ['SecurityError', 'passkeys.errors.insecure'],
    ['NotSupportedError', 'passkeys.errors.unsupported'],
    ['UnknownError', 'passkeys.errors.generic'],
  ])('maps a %s from the device', async (name, key) => {
    useScenario('anonymous-default')
    const webauthn = installWebAuthn()
    webauthn.get.mockRejectedValueOnce(new DOMException('x', name))
    const { result } = await setup()
    await result.signIn()
    expect(result.messageKey.value).toBe(key)
    expect(result.problem.value).toBeNull()
  })

  it('suggests the password after a rejected passkey and restarts after an expired challenge', async () => {
    useScenario('anonymous-default')
    const webauthn = installWebAuthn()
    answerWith(webauthn, SEEDED_CREDENTIALS.unknown)
    const { result } = await setup()
    await result.signIn()
    expect(result.messageKey.value).toBe('auth.passkey.failed')
    mockState().session.passkeyChallenge = null
    result.report(
      (await import('@/api')).ApiProblem.fromParts({
        kind: 'problem',
        status: 401,
        type: '/api/v2/problems/sign-in-expired',
      }),
    )
    expect(result.messageKey.value).toBe('auth.passkey.expired')
  })

  it('starts the throttling countdown after 429', async () => {
    useScenario('passkey-throttled')
    const webauthn = installWebAuthn()
    answerWith(webauthn, SEEDED_CREDENTIALS.alice)
    const { result } = await setup()
    await result.signIn()
    await flushPromises()
    expect(result.throttle.active.value).toBe(true)
    expect(result.problem.value?.is('too-many-requests')).toBe(true)
  })
})
