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
        if (value instanceof ArrayBuffer) json[key] = toBase64Url(value)
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
  const { secureContext = true, supported = true, nativeJson = true, conditional = true } = options

  vi.stubGlobal('isSecureContext', secureContext)

  const get = vi.fn((_options?: CredentialRequestOptions) =>
    Promise.resolve(fakeCredential({ kind: 'assertion', withToJSON: nativeJson })),
  )
  const create = vi.fn((_options?: CredentialCreationOptions) =>
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
