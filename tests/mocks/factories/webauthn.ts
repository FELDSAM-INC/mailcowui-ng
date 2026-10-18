// WebAuthn helpers of the mock (research R22, R24): option builders, credential ID extraction
// from `attestationObject` and `rawId`, and contract-valid fake credentials for tests that only
// need a submitted credential (the mock never verifies signatures; the smoke suite does).
import type {
  WebAuthnAuthenticationResponse,
  WebAuthnCreationOptions,
  WebAuthnRegistrationResponse,
  WebAuthnRequestOptions,
} from '@/api'

import { base64url, randomBase64url } from './ids'

export const MOCK_RP_ID = 'localhost'
export const CHALLENGE_LIFETIME_MS = 5 * 60_000

export function requestOptions(
  init: { challenge?: string; allowCredentials?: string[]; rpId?: string } = {},
): WebAuthnRequestOptions {
  return {
    challenge: init.challenge ?? randomBase64url(32),
    rpId: init.rpId ?? MOCK_RP_ID,
    timeout: CHALLENGE_LIFETIME_MS,
    userVerification: 'required',
    allowCredentials: (init.allowCredentials ?? []).map((id) => ({
      type: 'public-key',
      id,
      transports: ['internal', 'hybrid'],
    })),
  }
}

export function creationOptions(init: {
  username: string
  challenge?: string
  excludeCredentials?: string[]
  rpId?: string
}): WebAuthnCreationOptions {
  return {
    rp: { id: init.rpId ?? MOCK_RP_ID, name: 'Mock mail server' },
    user: {
      id: base64url(Buffer.from(init.username, 'utf8')),
      name: init.username,
      displayName: init.username,
    },
    challenge: init.challenge ?? randomBase64url(32),
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    timeout: CHALLENGE_LIFETIME_MS,
    excludeCredentials: (init.excludeCredentials ?? []).map((id) => ({ type: 'public-key', id })),
    authenticatorSelection: {
      residentKey: 'required',
      requireResidentKey: true,
      userVerification: 'required',
    },
    attestation: 'none',
  }
}

// --- minimal CBOR (RFC 8949) for attestation objects -------------------------------------------

type Cbor = number | bigint | string | Uint8Array | boolean | null | Cbor[] | Map<Cbor, Cbor>

function decodeCbor(bytes: Uint8Array, offset = 0): { value: Cbor; offset: number } {
  const initial = bytes[offset]
  if (initial === undefined) throw new Error('CBOR: unexpected end')
  const major = initial >> 5
  const info = initial & 0x1f
  let position = offset + 1
  const readLength = (): number => {
    if (info < 24) return info
    const size = info === 24 ? 1 : info === 25 ? 2 : info === 26 ? 4 : info === 27 ? 8 : 0
    if (size === 0) throw new Error('CBOR: indefinite lengths are not supported')
    let length = 0
    for (let index = 0; index < size; index++)
      length = length * 256 + (bytes[position + index] ?? 0)
    position += size
    return length
  }
  switch (major) {
    case 0:
      return { value: readLength(), offset: position }
    case 1:
      return { value: -1 - readLength(), offset: position }
    case 2: {
      const length = readLength()
      return { value: bytes.slice(position, position + length), offset: position + length }
    }
    case 3: {
      const length = readLength()
      const text = new TextDecoder().decode(bytes.slice(position, position + length))
      return { value: text, offset: position + length }
    }
    case 4: {
      const length = readLength()
      const items: Cbor[] = []
      for (let index = 0; index < length; index++) {
        const item = decodeCbor(bytes, position)
        items.push(item.value)
        position = item.offset
      }
      return { value: items, offset: position }
    }
    case 5: {
      const length = readLength()
      const map = new Map<Cbor, Cbor>()
      for (let index = 0; index < length; index++) {
        const key = decodeCbor(bytes, position)
        const value = decodeCbor(bytes, key.offset)
        map.set(key.value, value.value)
        position = value.offset
      }
      return { value: map, offset: position }
    }
    case 7:
      if (info === 20) return { value: false, offset: position }
      if (info === 21) return { value: true, offset: position }
      if (info === 22) return { value: null, offset: position }
      throw new Error('CBOR: unsupported simple value')
    default:
      throw new Error(`CBOR: unsupported major type ${major}`)
  }
}

function encodeHead(major: number, length: number): number[] {
  if (length < 24) return [(major << 5) | length]
  if (length < 256) return [(major << 5) | 24, length]
  return [(major << 5) | 25, length >> 8, length & 0xff]
}

function encodeText(text: string): number[] {
  const bytes = new TextEncoder().encode(text)
  return [...encodeHead(3, bytes.length), ...bytes]
}

/** A `none` attestation object whose authenticator data carries the credential ID. */
export function fakeAttestationObject(credentialId: string): string {
  const id = Buffer.from(credentialId, 'base64url')
  const coseKey = [0xa1, 0x01, 0x02] // {1: 2} (kty: EC2), enough for the mock
  const authData = [
    ...new Array<number>(32).fill(0), // rpIdHash
    0x45, // flags: user present, user verified, attested credential data
    0,
    0,
    0,
    0, // signCount
    ...new Array<number>(16).fill(0), // AAGUID
    id.length >> 8,
    id.length & 0xff,
    ...id,
    ...coseKey,
  ]
  const bytes = [
    ...encodeHead(5, 3),
    ...encodeText('fmt'),
    ...encodeText('none'),
    ...encodeText('attStmt'),
    ...encodeHead(5, 0),
    ...encodeText('authData'),
    ...encodeHead(2, authData.length),
    ...authData,
  ]
  return base64url(Uint8Array.from(bytes))
}

/** The credential ID inside a registration's `attestationObject`. */
export function credentialIdFromAttestation(attestationObject: string): string {
  const decoded = decodeCbor(new Uint8Array(Buffer.from(attestationObject, 'base64url'))).value
  if (!(decoded instanceof Map)) throw new Error('attestationObject is not a CBOR map')
  const authData = decoded.get('authData')
  if (!(authData instanceof Uint8Array)) throw new Error('attestationObject has no authData')
  const flags = authData[32] ?? 0
  if ((flags & 0x40) === 0) throw new Error('authData has no attested credential data')
  const lengthOffset = 32 + 1 + 4 + 16
  const length = ((authData[lengthOffset] ?? 0) << 8) | (authData[lengthOffset + 1] ?? 0)
  return base64url(authData.slice(lengthOffset + 2, lengthOffset + 2 + length))
}

export function credentialIdFromRegistration(response: WebAuthnRegistrationResponse): string {
  return credentialIdFromAttestation(response.response.attestationObject)
}

export function credentialIdFromAssertion(response: WebAuthnAuthenticationResponse): string {
  return response.rawId
}

/** The challenge a credential's clientDataJSON was made for. */
export function challengeOf(clientDataJSON: string): string | null {
  try {
    const data = JSON.parse(Buffer.from(clientDataJSON, 'base64url').toString('utf8')) as {
      challenge?: unknown
    }
    return typeof data.challenge === 'string' ? data.challenge : null
  } catch {
    return null
  }
}

function clientData(type: 'webauthn.get' | 'webauthn.create', challenge: string): string {
  const json = JSON.stringify({ type, challenge, origin: 'http://localhost', crossOrigin: false })
  return base64url(Buffer.from(json, 'utf8'))
}

/** A contract-valid assertion for a credential and challenge. */
export function fakeAssertion(
  credentialId: string,
  challenge: string,
): WebAuthnAuthenticationResponse {
  return {
    id: credentialId,
    rawId: credentialId,
    type: 'public-key',
    response: {
      clientDataJSON: clientData('webauthn.get', challenge),
      authenticatorData: randomBase64url(37),
      signature: randomBase64url(70),
      userHandle: randomBase64url(16),
    },
    authenticatorAttachment: 'platform',
    clientExtensionResults: {},
  }
}

/** A contract-valid registration for a credential and challenge. */
export function fakeRegistration(
  credentialId: string,
  challenge: string,
): WebAuthnRegistrationResponse {
  return {
    id: credentialId,
    rawId: credentialId,
    type: 'public-key',
    response: {
      clientDataJSON: clientData('webauthn.create', challenge),
      attestationObject: fakeAttestationObject(credentialId),
      transports: ['internal', 'hybrid'],
    },
    authenticatorAttachment: 'platform',
    clientExtensionResults: {},
  }
}
