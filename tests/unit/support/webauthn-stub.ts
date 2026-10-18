// Per-test stubs of the WebAuthn browser API (research R23). jsdom has no PublicKeyCredential and
// no navigator.credentials, so tests install exactly the capabilities they need.
import { vi } from 'vitest'

export interface WebAuthnStubOptions {
  /** `window.isSecureContext`; default true. */
  secureContext?: boolean
  /** Whether `PublicKeyCredential` exists at all; default true. */
  supported?: boolean
  /** Whether the Level 3 JSON helpers (`parse*FromJSON`, `toJSON`) exist; default true. */
  nativeJson?: boolean
  /** Result of `isConditionalMediationAvailable()`; undefined removes the method. */
  conditional?: boolean | undefined
}

export function bytes(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer
}

function toBase64Url(buffer: ArrayBuffer): string {
  let binary = ''
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

interface FakeCredentialInit {
  id?: string
  kind: 'assertion' | 'attestation'
  withToJSON: boolean
}

export function fakeCredential({ id = 'cred-1', kind, withToJSON }: FakeCredentialInit) {
  const rawId = bytes(id)
  const response =
    kind === 'assertion'
      ? {
          clientDataJSON: bytes('{"type":"webauthn.get"}'),
          authenticatorData: bytes('auth-data'),
          signature: bytes('signature'),
          userHandle: bytes('user-handle'),
        }
      : {
          clientDataJSON: bytes('{"type":"webauthn.create"}'),
          attestationObject: bytes('attestation'),
          getTransports: () => ['internal', 'hybrid'],
          getAuthenticatorData: () => bytes('auth-data'),
          getPublicKey: () => bytes('public-key'),
          getPublicKeyAlgorithm: () => -7,
        }
  const credential: Record<string, unknown> = {
    id: toBase64Url(rawId),
    rawId,
    type: 'public-key',
    authenticatorAttachment: 'platform',
    response,
    getClientExtensionResults: () => ({}),
  }
  if (withToJSON) {
    credential.toJSON = () => {
      const json: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(response)) {
        // TextEncoder buffers come from another realm under jsdom, so no `instanceof` check.
        if (Object.prototype.toString.call(value) === '[object ArrayBuffer]') {
          json[key] = toBase64Url(value as ArrayBuffer)
        }
      }
      if (kind === 'attestation') json.transports = ['internal', 'hybrid']
      return {
        id: credential.id,
        rawId: credential.id,
        type: 'public-key',
        authenticatorAttachment: 'platform',
        response: json,
        clientExtensionResults: {},
      }
    }
  }
  return credential
}

export function installWebAuthn(options: WebAuthnStubOptions = {}) {
  const { secureContext = true, supported = true, nativeJson = true } = options
  // An explicit `conditional: undefined` removes the method, so no destructuring default here.
  const conditional = 'conditional' in options ? options.conditional : true

  vi.stubGlobal('isSecureContext', secureContext)

  const get = vi.fn((_options?: CredentialRequestOptions): Promise<unknown> =>
    Promise.resolve(fakeCredential({ kind: 'assertion', withToJSON: nativeJson })),
  )
  const create = vi.fn((_options?: CredentialCreationOptions): Promise<unknown> =>
    Promise.resolve(fakeCredential({ kind: 'attestation', withToJSON: nativeJson })),
  )
  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    value: { get, create },
  })

  if (!supported) {
    vi.stubGlobal('PublicKeyCredential', undefined)
    return { get, create, PublicKeyCredential: undefined }
  }

  const PublicKeyCredential = function PublicKeyCredential() {
    throw new TypeError('Illegal constructor')
  } as unknown as Record<string, unknown>
  if (conditional !== undefined) {
    PublicKeyCredential.isConditionalMediationAvailable = vi.fn(() => Promise.resolve(conditional))
  }
  if (nativeJson) {
    PublicKeyCredential.parseRequestOptionsFromJSON = vi.fn((json: Record<string, unknown>) => ({
      ...json,
      __parsed: 'native',
    }))
    PublicKeyCredential.parseCreationOptionsFromJSON = vi.fn((json: Record<string, unknown>) => ({
      ...json,
      __parsed: 'native',
    }))
  }
  vi.stubGlobal('PublicKeyCredential', PublicKeyCredential)
  return { get, create, PublicKeyCredential }
}

function bufferToBase64Url(value: unknown): string {
  if (typeof value === 'string') return value
  const bytes =
    value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : ArrayBuffer.isView(value)
        ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
        : new Uint8Array(value as ArrayBuffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * A credential answering a get() call: its JSON carries `credentialId` as `rawId` and a
 * clientDataJSON for the challenge of the request, so the mock API accepts or refuses it by the
 * credential alone.
 */
export function credentialFor(credentialId: string, options: CredentialRequestOptions): Credential {
  const challenge = bufferToBase64Url(options.publicKey?.challenge)
  const clientDataJSON = bufferToBase64Url(
    new TextEncoder().encode(JSON.stringify({ type: 'webauthn.get', challenge })),
  )
  const response = {
    clientDataJSON,
    authenticatorData: bufferToBase64Url(bytes('auth-data')),
    signature: bufferToBase64Url(bytes('signature')),
    userHandle: bufferToBase64Url(bytes('user-handle')),
  }
  return {
    id: credentialId,
    type: 'public-key',
    toJSON: () => ({
      id: credentialId,
      rawId: credentialId,
      type: 'public-key',
      authenticatorAttachment: 'platform',
      response,
      clientExtensionResults: {},
    }),
  } as unknown as Credential
}
