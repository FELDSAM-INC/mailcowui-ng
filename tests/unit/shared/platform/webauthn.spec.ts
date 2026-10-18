// T036: the WebAuthn platform module (research R14): support detection, the base64url codec,
// option conversion, credential serialisation, the single abort controller and the error mapping.
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'

import type {
  WebAuthnAuthenticationResponse,
  WebAuthnCreationOptions,
  WebAuthnRegistrationResponse,
  WebAuthnRequestOptions,
} from '@/api'
import {
  abortCeremony,
  classifyWebAuthnError,
  conditionalMediationAvailable,
  createRegistration,
  fromBase64Url,
  getAssertion,
  isCeremonyRunning,
  passkeysSupported,
  serializeAssertion,
  serializeRegistration,
  toBase64Url,
  toCreationOptions,
  toRequestOptions,
  WebAuthnCeremonyError,
  webAuthnMessageKey,
  type WebAuthnErrorKind,
} from '@/shared/platform/webauthn'

import { bytes, fakeCredential, installWebAuthn } from '../../support/webauthn-stub'

const BASE64URL = /^[A-Za-z0-9_-]*$/

function text(buffer: unknown): string {
  expect(buffer).toBeInstanceOf(ArrayBuffer)
  return new TextDecoder().decode(buffer as ArrayBuffer)
}

function installSupported(options: Parameters<typeof installWebAuthn>[0] = {}) {
  const stub = installWebAuthn(options)
  if (!stub.PublicKeyCredential) throw new Error('PublicKeyCredential stub missing')
  return { ...stub, PublicKeyCredential: stub.PublicKeyCredential }
}

const requestJson: WebAuthnRequestOptions = {
  challenge: toBase64Url(bytes('challenge')),
  rpId: 'mail.example.org',
  timeout: 300000,
  userVerification: 'required',
  allowCredentials: [
    { type: 'public-key', id: toBase64Url(bytes('cred-a')), transports: ['internal'] },
    { type: 'public-key', id: toBase64Url(bytes('cred-b')) },
  ],
  extensions: { appid: 'https://mail.example.org/' },
}

const creationJson: WebAuthnCreationOptions = {
  rp: { id: 'mail.example.org', name: 'Example Mail' },
  user: { id: toBase64Url(bytes('user-handle')), name: 'admin', displayName: 'admin' },
  challenge: toBase64Url(bytes('create-challenge')),
  pubKeyCredParams: [
    { type: 'public-key', alg: -7 },
    { type: 'public-key', alg: -257 },
  ],
  timeout: 300000,
  excludeCredentials: [{ type: 'public-key', id: toBase64Url(bytes('existing')) }],
  authenticatorSelection: {
    residentKey: 'required',
    requireResidentKey: true,
    userVerification: 'required',
  },
  attestation: 'none',
  extensions: { credProps: true },
}

afterEach(() => {
  abortCeremony()
})

describe('support detection', () => {
  it('is supported in a secure context with PublicKeyCredential', () => {
    installWebAuthn()
    expect(passkeysSupported()).toBe(true)
  })

  it('is not supported outside a secure context', () => {
    installWebAuthn({ secureContext: false })
    expect(passkeysSupported()).toBe(false)
  })

  it('is not supported without PublicKeyCredential', () => {
    installWebAuthn({ supported: false })
    expect(passkeysSupported()).toBe(false)
  })
})

describe('conditional mediation', () => {
  it('reports the browser answer', async () => {
    installWebAuthn({ conditional: true })
    await expect(conditionalMediationAvailable()).resolves.toBe(true)
    installWebAuthn({ conditional: false })
    await expect(conditionalMediationAvailable()).resolves.toBe(false)
  })

  it('is false when the method is missing', async () => {
    installWebAuthn({ conditional: undefined })
    await expect(conditionalMediationAvailable()).resolves.toBe(false)
  })

  it('is false when the method rejects', async () => {
    const { PublicKeyCredential } = installSupported()
    PublicKeyCredential.isConditionalMediationAvailable = vi.fn(() =>
      Promise.reject(new Error('boom')),
    )
    await expect(conditionalMediationAvailable()).resolves.toBe(false)
  })

  it('is false when passkeys are not supported', async () => {
    installWebAuthn({ supported: false })
    await expect(conditionalMediationAvailable()).resolves.toBe(false)
  })
})

describe('base64url codec', () => {
  it('encodes without padding and with the URL-safe alphabet', () => {
    // 0xfb 0xff 0xbf encodes to "+/+/" in standard base64.
    const encoded = toBase64Url(new Uint8Array([0xfb, 0xff, 0xbf]))
    expect(encoded).toBe('-_-_')
    expect(toBase64Url(new Uint8Array([1]))).toBe('AQ')
    expect(toBase64Url(new Uint8Array([]))).toBe('')
  })

  it('round-trips arbitrary bytes, buffers and views', () => {
    const data = new Uint8Array(256).map((_, index) => index)
    const encoded = toBase64Url(data.buffer)
    expect(encoded).toMatch(BASE64URL)
    expect(new Uint8Array(fromBase64Url(encoded))).toEqual(data)
    const view = new DataView(data.buffer, 10, 5)
    expect(new Uint8Array(fromBase64Url(toBase64Url(view)))).toEqual(data.slice(10, 15))
    expect(fromBase64Url('').byteLength).toBe(0)
  })

  it('rejects invalid input', () => {
    expect(() => fromBase64Url('a+b/')).toThrow()
    expect(() => fromBase64Url('AQ==')).toThrow()
    expect(() => fromBase64Url('A')).toThrow()
  })
})

describe('option conversion', () => {
  it('uses the native JSON parsers when they exist', () => {
    const { PublicKeyCredential } = installSupported({ nativeJson: true })
    const request = toRequestOptions(requestJson) as unknown as Record<string, unknown>
    expect(request.__parsed).toBe('native')
    expect(PublicKeyCredential.parseRequestOptionsFromJSON).toHaveBeenCalledWith(requestJson)
    const creation = toCreationOptions(creationJson) as unknown as Record<string, unknown>
    expect(creation.__parsed).toBe('native')
    expect(PublicKeyCredential.parseCreationOptionsFromJSON).toHaveBeenCalledWith(creationJson)
  })

  it('converts request options with the fallback codec', () => {
    installWebAuthn({ nativeJson: false })
    const options = toRequestOptions(requestJson)
    expect(text(options.challenge)).toBe('challenge')
    expect(options.allowCredentials?.map((credential) => text(credential.id))).toEqual([
      'cred-a',
      'cred-b',
    ])
    expect(options.allowCredentials?.[0]?.transports).toEqual(['internal'])
    expect(options.allowCredentials?.[0]?.type).toBe('public-key')
    expect(options.rpId).toBe('mail.example.org')
    expect(options.timeout).toBe(300000)
    expect(options.userVerification).toBe('required')
    expect(options.extensions).toEqual({ appid: 'https://mail.example.org/' })
  })

  it('converts creation options with the fallback codec', () => {
    installWebAuthn({ nativeJson: false })
    const options = toCreationOptions(creationJson)
    expect(text(options.challenge)).toBe('create-challenge')
    expect(text(options.user.id)).toBe('user-handle')
    expect(options.user.name).toBe('admin')
    expect(options.excludeCredentials?.map((credential) => text(credential.id))).toEqual([
      'existing',
    ])
    expect(options.rp).toEqual({ id: 'mail.example.org', name: 'Example Mail' })
    expect(options.pubKeyCredParams).toEqual(creationJson.pubKeyCredParams)
    expect(options.authenticatorSelection).toEqual(creationJson.authenticatorSelection)
    expect(options.attestation).toBe('none')
    expect(options.extensions).toEqual({ credProps: true })
  })

  it('falls back when PublicKeyCredential is missing entirely', () => {
    installWebAuthn({ supported: false })
    expect(text(toRequestOptions(requestJson).challenge)).toBe('challenge')
  })
})

function expectAssertionShape(json: WebAuthnAuthenticationResponse) {
  expect(json.type).toBe('public-key')
  for (const value of [
    json.id,
    json.rawId,
    json.response.clientDataJSON,
    json.response.authenticatorData,
    json.response.signature,
  ]) {
    expect(value).toMatch(BASE64URL)
  }
  if (json.response.userHandle != null) expect(json.response.userHandle).toMatch(BASE64URL)
}

function expectRegistrationShape(json: WebAuthnRegistrationResponse) {
  expect(json.type).toBe('public-key')
  for (const value of [
    json.id,
    json.rawId,
    json.response.clientDataJSON,
    json.response.attestationObject,
  ]) {
    expect(value).toMatch(BASE64URL)
  }
  for (const value of [json.response.authenticatorData, json.response.publicKey]) {
    if (value !== undefined) expect(value).toMatch(BASE64URL)
  }
}

describe('credential serialisation', () => {
  it('uses toJSON for assertions when available', () => {
    const credential = fakeCredential({ kind: 'assertion', withToJSON: true })
    const json = serializeAssertion(credential as unknown as PublicKeyCredential)
    expectTypeOf(json).toEqualTypeOf<WebAuthnAuthenticationResponse>()
    expectAssertionShape(json)
    expect(json.rawId).toBe(toBase64Url(bytes('cred-1')))
  })

  it('serialises assertions with the fallback codec', () => {
    const credential = fakeCredential({ kind: 'assertion', withToJSON: false })
    const json = serializeAssertion(credential as unknown as PublicKeyCredential)
    expectAssertionShape(json)
    expect(json).toEqual({
      id: toBase64Url(bytes('cred-1')),
      rawId: toBase64Url(bytes('cred-1')),
      type: 'public-key',
      authenticatorAttachment: 'platform',
      clientExtensionResults: {},
      response: {
        clientDataJSON: toBase64Url(bytes('{"type":"webauthn.get"}')),
        authenticatorData: toBase64Url(bytes('auth-data')),
        signature: toBase64Url(bytes('signature')),
        userHandle: toBase64Url(bytes('user-handle')),
      },
    })
  })

  it('serialises a missing user handle and attachment as null', () => {
    const credential = fakeCredential({ kind: 'assertion', withToJSON: false })
    const response = credential.response as Record<string, unknown>
    response.userHandle = null
    credential.authenticatorAttachment = null
    delete credential.getClientExtensionResults
    const json = serializeAssertion(credential as unknown as PublicKeyCredential)
    expect(json.response.userHandle).toBeNull()
    expect(json.authenticatorAttachment).toBeNull()
    expect(json.clientExtensionResults).toEqual({})
  })

  it('falls back when toJSON returns something unusable', () => {
    const credential = fakeCredential({ kind: 'assertion', withToJSON: false })
    credential.toJSON = () => 'nonsense'
    const json = serializeAssertion(credential as unknown as PublicKeyCredential)
    expectAssertionShape(json)
  })

  it('uses toJSON for registrations when available', () => {
    const credential = fakeCredential({ kind: 'attestation', withToJSON: true })
    const json = serializeRegistration(credential as unknown as PublicKeyCredential)
    expectTypeOf(json).toEqualTypeOf<WebAuthnRegistrationResponse>()
    expectRegistrationShape(json)
    expect(json.response.transports).toEqual(['internal', 'hybrid'])
  })

  it('serialises registrations with the fallback codec', () => {
    const credential = fakeCredential({ kind: 'attestation', withToJSON: false })
    const json = serializeRegistration(credential as unknown as PublicKeyCredential)
    expectRegistrationShape(json)
    expect(json).toEqual({
      id: toBase64Url(bytes('cred-1')),
      rawId: toBase64Url(bytes('cred-1')),
      type: 'public-key',
      authenticatorAttachment: 'platform',
      clientExtensionResults: {},
      response: {
        clientDataJSON: toBase64Url(bytes('{"type":"webauthn.create"}')),
        attestationObject: toBase64Url(bytes('attestation')),
        transports: ['internal', 'hybrid'],
        authenticatorData: toBase64Url(bytes('auth-data')),
        publicKey: toBase64Url(bytes('public-key')),
        publicKeyAlgorithm: -7,
      },
    })
  })

  it('omits the optional registration getters when the browser lacks them', () => {
    const credential = fakeCredential({ kind: 'attestation', withToJSON: false })
    const response = credential.response as Record<string, unknown>
    delete response.getTransports
    delete response.getAuthenticatorData
    response.getPublicKey = () => null
    delete response.getPublicKeyAlgorithm
    const json = serializeRegistration(credential as unknown as PublicKeyCredential)
    expect(json.response).toEqual({
      clientDataJSON: toBase64Url(bytes('{"type":"webauthn.create"}')),
      attestationObject: toBase64Url(bytes('attestation')),
    })
  })
})

describe('ceremonies', () => {
  it('gets an assertion with the converted options and returns its JSON', async () => {
    const { get } = installWebAuthn({ nativeJson: false })
    const json = await getAssertion(requestJson)
    expectAssertionShape(json)
    const call = get.mock.calls[0]?.[0]
    expect(text(call?.publicKey?.challenge)).toBe('challenge')
    expect(call?.signal).toBeInstanceOf(AbortSignal)
    expect(call).not.toHaveProperty('mediation')
    expect(isCeremonyRunning()).toBe(false)
  })

  it('passes conditional mediation through', async () => {
    const { get } = installWebAuthn()
    await getAssertion(requestJson, { mediation: 'conditional' })
    expect(get.mock.calls[0]?.[0]?.mediation).toBe('conditional')
  })

  it('creates a registration and returns its JSON', async () => {
    const { create } = installWebAuthn({ nativeJson: false })
    const json = await createRegistration(creationJson)
    expectRegistrationShape(json)
    const call = create.mock.calls[0]?.[0]
    expect(text(call?.publicKey?.user.id)).toBe('user-handle')
    expect(call?.signal).toBeInstanceOf(AbortSignal)
  })

  it('aborts the running ceremony when a new one starts', async () => {
    const { get } = installWebAuthn()
    const signals: AbortSignal[] = []
    get.mockImplementationOnce(
      (options) =>
        new Promise<Record<string, unknown>>((_resolve, reject) => {
          const signal = options?.signal
          if (signal) {
            signals.push(signal)
            signal.addEventListener('abort', () => reject(signal.reason as Error))
          }
        }),
    )
    const first = getAssertion(requestJson, { mediation: 'conditional' })
    expect(isCeremonyRunning()).toBe(true)
    const second = getAssertion(requestJson)
    await expect(first).rejects.toMatchObject({ kind: 'aborted' })
    expect(signals[0]?.aborted).toBe(true)
    await expect(second).resolves.toMatchObject({ type: 'public-key' })
    expect(isCeremonyRunning()).toBe(false)
  })

  it('abortCeremony aborts the running ceremony with an AbortError', async () => {
    const { create } = installWebAuthn()
    let signal: AbortSignal | undefined
    create.mockImplementationOnce(
      (options) =>
        new Promise<Record<string, unknown>>((_resolve, reject) => {
          signal = options?.signal ?? undefined
          signal?.addEventListener('abort', () => reject(signal?.reason as Error))
        }),
    )
    const pending = createRegistration(creationJson)
    abortCeremony()
    const error: unknown = await pending.catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(WebAuthnCeremonyError)
    expect((error as WebAuthnCeremonyError).kind).toBe('aborted')
    expect((signal?.reason as DOMException).name).toBe('AbortError')
    expect(isCeremonyRunning()).toBe(false)
    expect(() => abortCeremony()).not.toThrow()
  })

  it('classifies a rejected prompt', async () => {
    const { get, create } = installWebAuthn()
    get.mockRejectedValueOnce(new DOMException('cancelled', 'NotAllowedError'))
    await expect(getAssertion(requestJson)).rejects.toMatchObject({ kind: 'cancelled' })
    create.mockRejectedValueOnce(new DOMException('exists', 'InvalidStateError'))
    const error: unknown = await createRegistration(creationJson).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(WebAuthnCeremonyError)
    expect((error as WebAuthnCeremonyError).kind).toBe('alreadyRegistered')
    expect((error as WebAuthnCeremonyError).cause).toBeInstanceOf(DOMException)
  })

  it('treats a null credential as an unknown failure', async () => {
    const { get } = installWebAuthn()
    get.mockResolvedValueOnce(null as unknown as Record<string, unknown>)
    await expect(getAssertion(requestJson)).rejects.toMatchObject({ kind: 'unknown' })
  })
})

describe('error mapping (research R14)', () => {
  const table: [unknown, 'get' | 'create', WebAuthnErrorKind][] = [
    [new DOMException('x', 'NotAllowedError'), 'get', 'cancelled'],
    [new DOMException('x', 'NotAllowedError'), 'create', 'cancelled'],
    [new DOMException('x', 'AbortError'), 'get', 'aborted'],
    [new DOMException('x', 'InvalidStateError'), 'create', 'alreadyRegistered'],
    [new DOMException('x', 'InvalidStateError'), 'get', 'unknown'],
    [new DOMException('x', 'SecurityError'), 'get', 'insecure'],
    [new DOMException('x', 'NotSupportedError'), 'create', 'unsupported'],
    [new DOMException('x', 'ConstraintError'), 'create', 'unsupported'],
    [new DOMException('x', 'UnknownError'), 'get', 'unknown'],
    [new TypeError('bad options'), 'get', 'unknown'],
    ['not an error', 'create', 'unknown'],
    [null, 'get', 'unknown'],
  ]

  it.each(table)('%s during %s is %s', (error, ceremony, kind) => {
    expect(classifyWebAuthnError(error, ceremony)).toBe(kind)
  })

  it('maps kinds to message keys, silent for cancelled and aborted', () => {
    expect(webAuthnMessageKey('cancelled')).toBeNull()
    expect(webAuthnMessageKey('aborted')).toBeNull()
    expect(webAuthnMessageKey('alreadyRegistered')).toBe('passkeys.errors.alreadyRegistered')
    expect(webAuthnMessageKey('insecure')).toBe('passkeys.errors.insecure')
    expect(webAuthnMessageKey('unsupported')).toBe('passkeys.errors.unsupported')
    expect(webAuthnMessageKey('unknown')).toBe('passkeys.errors.generic')
  })

  it('WebAuthnCeremonyError carries its kind and cause', () => {
    const cause = new DOMException('x', 'SecurityError')
    const error = new WebAuthnCeremonyError('insecure', cause)
    expect(error).toBeInstanceOf(Error)
    expect(error.kind).toBe('insecure')
    expect(error.cause).toBe(cause)
    expect(error.name).toBe('WebAuthnCeremonyError')
  })
})
