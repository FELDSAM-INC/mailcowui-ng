import { afterEach, describe, expect, it } from 'vitest'

import type { WebAuthnRequestOptions } from '@/api'
import {
  abortCeremony,
  createRegistration,
  getAssertion,
  toBase64Url,
} from '@/shared/platform/webauthn'

import { creationOptions } from '../../../mocks/factories/webauthn'
import { bytes, fakeCredential, installWebAuthn } from '../../support/webauthn-stub'

const options: WebAuthnRequestOptions = {
  challenge: toBase64Url(bytes('challenge')),
  rpId: 'localhost',
  timeout: 300_000,
  userVerification: 'required',
  allowCredentials: [],
}

afterEach(() => abortCeremony())

describe('WebAuthn caller cancellation', () => {
  it.each(['get', 'create'] as const)(
    'aborts only its %s ceremony when its caller leaves',
    async (kind) => {
      const stub = installWebAuthn()
      let nativeSignal!: AbortSignal
      stub[kind].mockImplementationOnce(
        (input) =>
          new Promise((_resolve, reject) => {
            nativeSignal = input!.signal!
            nativeSignal.addEventListener('abort', () => reject(nativeSignal.reason as Error))
          }),
      )
      const controller = new AbortController()
      const pending = (
        kind === 'get'
          ? getAssertion(options, { signal: controller.signal })
          : createRegistration(creationOptions({ username: 'anna@example.org' }), {
              signal: controller.signal,
            })
      ).catch((error: unknown) => error)
      controller.abort()
      expect(nativeSignal.aborted).toBe(true)
      expect(await pending).toMatchObject({ kind: 'aborted' })
    },
  )

  it('does not open the browser prompt for an already-cancelled caller', async () => {
    const { get } = installWebAuthn()
    const controller = new AbortController()
    controller.abort()
    await expect(getAssertion(options, { signal: controller.signal })).rejects.toMatchObject({
      kind: 'aborted',
    })
    expect(get).not.toHaveBeenCalled()
  })

  it('cancelling an older caller does not abort a newer ceremony', async () => {
    const { get } = installWebAuthn()
    const signals: AbortSignal[] = []
    get.mockImplementation(
      (input) =>
        new Promise((_resolve, reject) => {
          const signal = input!.signal!
          signals.push(signal)
          signal.addEventListener('abort', () => reject(signal.reason as Error))
        }),
    )
    const old = new AbortController()
    const current = new AbortController()
    const first = getAssertion(options, { signal: old.signal }).catch((error: unknown) => error)
    const second = getAssertion(options, { signal: current.signal }).catch(
      (error: unknown) => error,
    )
    old.abort()
    expect(signals[0]!.aborted).toBe(true)
    expect(signals[1]!.aborted).toBe(false)
    current.abort()
    expect(signals[1]!.aborted).toBe(true)
    expect(await first).toMatchObject({ kind: 'aborted' })
    expect(await second).toMatchObject({ kind: 'aborted' })
  })

  it('discards a credential delivered after the caller cancelled the prompt', async () => {
    const { get } = installWebAuthn()
    let release!: (value: Record<string, unknown>) => void
    get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    )
    const controller = new AbortController()
    const pending = getAssertion(options, { signal: controller.signal }).catch(
      (error: unknown) => error,
    )
    controller.abort()
    release(fakeCredential({ kind: 'assertion', withToJSON: false }))
    expect(await pending).toMatchObject({ kind: 'aborted' })
  })
})
