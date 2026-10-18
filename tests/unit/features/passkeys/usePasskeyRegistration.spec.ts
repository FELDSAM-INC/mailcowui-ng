// T104: passkey registration (FR-053, FR-039, research R14): options, create(), register with an
// optional name; a cancelled prompt is silent; InvalidStateError, passkey-registration-failed and
// 422 are mapped to messages.
import { afterEach, describe, expect, it } from 'vitest'

import { queryKeys, type Session } from '@/api'
import { setSessionContext } from '@/app/session/context'
import { usePasskeyRegistration } from '@/features/passkeys'
import { createAppChannel } from '@/shared/platform/broadcast'

import { fakeAttestationObject } from '../../../mocks/factories/webauthn'
import { mockState, useScenario } from '../../../mocks/node'
import { withSetup } from '../../support/composable'
import { testPlugins } from '../../support/mount'
import { createTestRouter } from '../../support/router'
import { installWebAuthn } from '../../support/webauthn-stub'

afterEach(() => setSessionContext(null))

/** navigator.credentials.create answering for the challenge with a registrable credential. */
function createAnswers(webauthn: ReturnType<typeof installWebAuthn>, credentialId: string) {
  webauthn.create.mockImplementation((options?: CredentialCreationOptions) => {
    const challenge = options!.publicKey!.challenge as unknown
    const encoded =
      typeof challenge === 'string'
        ? challenge
        : Buffer.from(challenge as ArrayBuffer).toString('base64url')
    const response = {
      clientDataJSON: Buffer.from(
        JSON.stringify({ type: 'webauthn.create', challenge: encoded }),
      ).toString('base64url'),
      attestationObject: fakeAttestationObject(credentialId),
    }
    return Promise.resolve({
      id: credentialId,
      type: 'public-key',
      toJSON: () => ({
        id: credentialId,
        rawId: credentialId,
        type: 'public-key',
        response,
        clientExtensionResults: {},
      }),
    })
  })
}

async function setup() {
  const router = createTestRouter()
  const queryClient = testPlugins().queryClient
  setSessionContext({ queryClient, router, channel: createAppChannel('test') })
  await router.push('/passkeys')
  return withSetup(() => usePasskeyRegistration(), { router }).result
}

describe('usePasskeyRegistration', () => {
  it('registers with an optional name and refreshes the list, the identity and the session', async () => {
    useScenario('admin-no-passkeys')
    const webauthn = installWebAuthn()
    createAnswers(webauthn, 'bmV3LWNyZWQ')
    const registration = await setup()
    const created = await registration.register('  Laptop  ')
    expect(created?.name).toBe('Laptop')
    const ops = mockState().requests.map((r) => r.operationId)
    expect(ops).toEqual(
      expect.arrayContaining([
        'createPasskeyRegistrationOptions',
        'registerPasskey',
        'getIdentity',
        'getSession',
      ]),
    )
    const body = mockState().requests.find((r) => r.operationId === 'registerPasskey')?.body
    expect(body).toMatchObject({ name: 'Laptop' })
  })

  it('sends no name when none is given', async () => {
    useScenario('admin-no-passkeys')
    createAnswers(installWebAuthn(), 'bm8tbmFtZQ')
    const registration = await setup()
    await registration.register('   ')
    const body = mockState().requests.find((r) => r.operationId === 'registerPasskey')?.body
    expect(body).not.toHaveProperty('name')
  })

  it('stays silent after a cancelled prompt', async () => {
    useScenario('admin-no-passkeys')
    installWebAuthn().create.mockRejectedValueOnce(new DOMException('x', 'NotAllowedError'))
    const registration = await setup()
    expect(await registration.register()).toBeNull()
    expect(registration.messageKey.value).toBeNull()
    expect(registration.problem.value).toBeNull()
  })

  it('maps an authenticator that already holds a passkey', async () => {
    useScenario('admin-no-passkeys')
    installWebAuthn().create.mockRejectedValueOnce(new DOMException('x', 'InvalidStateError'))
    const registration = await setup()
    await registration.register()
    expect(registration.messageKey.value).toBe('passkeys.errors.alreadyRegistered')
  })

  it('maps a rejected registration', async () => {
    useScenario('passkey-registration-rejected')
    createAnswers(installWebAuthn(), 'cmVqZWN0ZWQ')
    const registration = await setup()
    await registration.register()
    expect(registration.problem.value?.is('passkey-registration-failed')).toBe(true)
  })

  it('maps a refused name to the field', async () => {
    useScenario('admin-no-passkeys', {
      failures: {
        registerPasskey: {
          status: 422,
          type: 'validation-failed',
          errors: { name: [{ code: 'tooLong', message: 'Too long.', params: { max: 255 } }] },
        },
      },
    })
    createAnswers(installWebAuthn(), 'bmFtZQ')
    const registration = await setup()
    await registration.register('x')
    expect(registration.problem.value?.is('validation-failed')).toBe(true)
  })

  it('tells other tabs when a restriction lifted', async () => {
    useScenario('anonymous-default', {
      signedInAs: 'admin',
      accounts: { admin: { pendingActions: ['secondFactorSetup'] } },
    })
    createAnswers(installWebAuthn(), 'bGlmdA')
    const registration = await setup()
    testPlugins().queryClient.setQueryData(queryKeys.session(), {
      state: 'restricted',
      pendingActions: ['secondFactorSetup'],
      idleTimeout: 600,
    } satisfies Session)
    await registration.register()
    expect(testPlugins().queryClient.getQueryData<Session>(queryKeys.session())?.state).toBe(
      'active',
    )
  })
})
