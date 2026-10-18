// Mapping of browser WebAuthn failures (research R14 error table). The rows that come from API
// problems (401 sign-in-failed, 401 sign-in-expired, 400 passkey-registration-failed, 429) are
// handled by the features through the problem type, not here.

export type WebAuthnErrorKind =
  'cancelled' | 'aborted' | 'alreadyRegistered' | 'insecure' | 'unsupported' | 'unknown'

function errorName(error: unknown): string | undefined {
  if (error === null || typeof error !== 'object') return undefined
  const { name } = error as { name?: unknown }
  return typeof name === 'string' ? name : undefined
}

export function classifyWebAuthnError(
  error: unknown,
  ceremony: 'get' | 'create',
): WebAuthnErrorKind {
  switch (errorName(error)) {
    case 'NotAllowedError':
      return 'cancelled'
    case 'AbortError':
      return 'aborted'
    case 'InvalidStateError':
      return ceremony === 'create' ? 'alreadyRegistered' : 'unknown'
    case 'SecurityError':
      return 'insecure'
    case 'NotSupportedError':
    case 'ConstraintError':
      return 'unsupported'
    default:
      return 'unknown'
  }
}

const MESSAGE_KEYS: Record<WebAuthnErrorKind, string | null> = {
  cancelled: null,
  aborted: null,
  alreadyRegistered: 'passkeys.errors.alreadyRegistered',
  insecure: 'passkeys.errors.insecure',
  unsupported: 'passkeys.errors.unsupported',
  unknown: 'passkeys.errors.generic',
}

/** The i18n key of the message to show, or null for the silent kinds (FR-013, US4 AS-8). */
export function webAuthnMessageKey(kind: WebAuthnErrorKind): string | null {
  return MESSAGE_KEYS[kind]
}

export class WebAuthnCeremonyError extends Error {
  readonly kind: WebAuthnErrorKind
  override readonly cause: unknown

  constructor(kind: WebAuthnErrorKind, cause: unknown) {
    super(`WebAuthn ceremony failed: ${kind}`)
    this.name = 'WebAuthnCeremonyError'
    this.kind = kind
    this.cause = cause
  }
}
