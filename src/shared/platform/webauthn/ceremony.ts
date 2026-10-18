// WebAuthn ceremonies with a single module-level AbortController (research R14): only one
// request runs at a time, and every new ceremony aborts the previous one first, which browsers
// require for conditional requests.
import type {
  WebAuthnAuthenticationResponse,
  WebAuthnCreationOptions,
  WebAuthnRegistrationResponse,
  WebAuthnRequestOptions,
} from '@/api'

import { serializeAssertion, serializeRegistration } from './credential'
import { classifyWebAuthnError, WebAuthnCeremonyError } from './errors'
import { toCreationOptions, toRequestOptions } from './options'

let current: AbortController | null = null

export function abortCeremony(): void {
  const controller = current
  current = null
  controller?.abort(new DOMException('The ceremony was aborted by the app.', 'AbortError'))
}

export function isCeremonyRunning(): boolean {
  return current !== null
}

async function run<T>(
  ceremony: 'get' | 'create',
  request: (signal: AbortSignal) => Promise<Credential | null>,
  serialize: (credential: PublicKeyCredential) => T,
): Promise<T> {
  abortCeremony()
  const controller = new AbortController()
  current = controller
  try {
    let credential: Credential | null
    try {
      credential = await request(controller.signal)
    } catch (error) {
      throw new WebAuthnCeremonyError(classifyWebAuthnError(error, ceremony), error)
    }
    if (credential === null || credential.type !== 'public-key') {
      throw new WebAuthnCeremonyError('unknown', credential)
    }
    return serialize(credential as PublicKeyCredential)
  } finally {
    if (current === controller) current = null
  }
}

export function getAssertion(
  options: WebAuthnRequestOptions,
  init: { mediation?: CredentialMediationRequirement } = {},
): Promise<WebAuthnAuthenticationResponse> {
  return run(
    'get',
    (signal) =>
      navigator.credentials.get({
        publicKey: toRequestOptions(options),
        signal,
        ...(init.mediation ? { mediation: init.mediation } : {}),
      }),
    serializeAssertion,
  )
}

export function createRegistration(
  options: WebAuthnCreationOptions,
): Promise<WebAuthnRegistrationResponse> {
  return run(
    'create',
    (signal) => navigator.credentials.create({ publicKey: toCreationOptions(options), signal }),
    serializeRegistration,
  )
}
