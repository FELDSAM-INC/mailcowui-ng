// WebAuthn platform module (research R14). Other code imports from `@/shared/platform/webauthn`.
export { fromBase64Url, toBase64Url } from './base64url'
export { abortCeremony, createRegistration, getAssertion, isCeremonyRunning } from './ceremony'
export { serializeAssertion, serializeRegistration } from './credential'
export {
  classifyWebAuthnError,
  WebAuthnCeremonyError,
  webAuthnMessageKey,
  type WebAuthnErrorKind,
} from './errors'
export { toCreationOptions, toRequestOptions } from './options'
export { conditionalMediationAvailable, passkeysSupported } from './support'
