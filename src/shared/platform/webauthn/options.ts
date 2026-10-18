// Conversion of the contract's WebAuthn Level 3 JSON options into the browser's binary options
// (research R14). The native `parse*FromJSON` methods are preferred; the fallback converts the
// binary members with the base64url codec and passes everything else through, `extensions`
// (including `appid`) unchanged.
import type { WebAuthnCreationOptions, WebAuthnRequestOptions } from '@/api'

import { fromBase64Url } from './base64url'
import { publicKeyCredential } from './support'

interface JsonParsers {
  parseRequestOptionsFromJSON?: (json: unknown) => PublicKeyCredentialRequestOptions
  parseCreationOptionsFromJSON?: (json: unknown) => PublicKeyCredentialCreationOptions
}

function parsers(): JsonParsers | undefined {
  return publicKeyCredential() as JsonParsers | undefined
}

function descriptor(json: WebAuthnRequestOptions['allowCredentials'][number]) {
  const result: PublicKeyCredentialDescriptor = { type: json.type, id: fromBase64Url(json.id) }
  if (json.transports) result.transports = json.transports as AuthenticatorTransport[]
  return result
}

export function toRequestOptions(json: WebAuthnRequestOptions): PublicKeyCredentialRequestOptions {
  const native = parsers()
  if (typeof native?.parseRequestOptionsFromJSON === 'function') {
    return native.parseRequestOptionsFromJSON(json)
  }
  const { challenge, allowCredentials, extensions, ...rest } = json
  const options: PublicKeyCredentialRequestOptions = {
    ...rest,
    challenge: fromBase64Url(challenge),
    allowCredentials: allowCredentials.map(descriptor),
  }
  if (extensions) options.extensions = extensions
  return options
}

export function toCreationOptions(
  json: WebAuthnCreationOptions,
): PublicKeyCredentialCreationOptions {
  const native = parsers()
  if (typeof native?.parseCreationOptionsFromJSON === 'function') {
    return native.parseCreationOptionsFromJSON(json)
  }
  const { challenge, user, excludeCredentials, extensions, ...rest } = json
  const options: PublicKeyCredentialCreationOptions = {
    ...rest,
    challenge: fromBase64Url(challenge),
    user: { ...user, id: fromBase64Url(user.id) },
    excludeCredentials: excludeCredentials.map(descriptor),
  }
  if (extensions) options.extensions = extensions
  return options
}
