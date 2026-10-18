// Serialisation of a browser credential into the contract's JSON request bodies (research R14).
// `credential.toJSON()` is preferred; some password manager extensions wrap
// `navigator.credentials` and return objects without it, so a fallback builds the same JSON.
import type { WebAuthnAuthenticationResponse, WebAuthnRegistrationResponse } from '@/api'

import { toBase64Url } from './base64url'

interface AssertionResponseLike {
  clientDataJSON: ArrayBuffer
  authenticatorData: ArrayBuffer
  signature: ArrayBuffer
  userHandle?: ArrayBuffer | null
}

interface AttestationResponseLike {
  clientDataJSON: ArrayBuffer
  attestationObject: ArrayBuffer
  getTransports?: () => string[]
  getAuthenticatorData?: () => ArrayBuffer
  getPublicKey?: () => ArrayBuffer | null
  getPublicKeyAlgorithm?: () => number
}

interface CredentialLike {
  rawId: ArrayBuffer
  authenticatorAttachment?: string | null
  response: unknown
  getClientExtensionResults?: () => AuthenticationExtensionsClientOutputs
  toJSON?: () => unknown
}

/** The native JSON when it has the contract's basic shape, otherwise undefined. */
function nativeJson(credential: CredentialLike): unknown {
  if (typeof credential.toJSON !== 'function') return undefined
  const json: unknown = credential.toJSON()
  if (json === null || typeof json !== 'object') return undefined
  const { id, rawId, response } = json as Record<string, unknown>
  if (typeof id !== 'string' || typeof rawId !== 'string') return undefined
  if (response === null || typeof response !== 'object') return undefined
  return json
}

function common(credential: CredentialLike) {
  const id = toBase64Url(credential.rawId)
  return {
    id,
    rawId: id,
    type: 'public-key' as const,
    authenticatorAttachment: credential.authenticatorAttachment ?? null,
    clientExtensionResults: {
      ...(credential.getClientExtensionResults?.() ?? {}),
    } as Record<string, unknown>,
  }
}

export function serializeAssertion(
  credential: PublicKeyCredential,
): WebAuthnAuthenticationResponse {
  const like = credential as unknown as CredentialLike
  const json = nativeJson(like)
  if (json) return json as WebAuthnAuthenticationResponse
  const response = like.response as AssertionResponseLike
  return {
    ...common(like),
    response: {
      clientDataJSON: toBase64Url(response.clientDataJSON),
      authenticatorData: toBase64Url(response.authenticatorData),
      signature: toBase64Url(response.signature),
      userHandle: response.userHandle ? toBase64Url(response.userHandle) : null,
    },
  }
}

export function serializeRegistration(
  credential: PublicKeyCredential,
): WebAuthnRegistrationResponse {
  const like = credential as unknown as CredentialLike
  const json = nativeJson(like)
  if (json) return json as WebAuthnRegistrationResponse
  const source = like.response as AttestationResponseLike
  const response: WebAuthnRegistrationResponse['response'] = {
    clientDataJSON: toBase64Url(source.clientDataJSON),
    attestationObject: toBase64Url(source.attestationObject),
  }
  const transports = source.getTransports?.()
  if (transports) response.transports = transports
  const authenticatorData = source.getAuthenticatorData?.()
  if (authenticatorData) response.authenticatorData = toBase64Url(authenticatorData)
  const publicKey = source.getPublicKey?.()
  if (publicKey) response.publicKey = toBase64Url(publicKey)
  const algorithm = source.getPublicKeyAlgorithm?.()
  if (typeof algorithm === 'number') response.publicKeyAlgorithm = algorithm
  return { ...common(like), response }
}
