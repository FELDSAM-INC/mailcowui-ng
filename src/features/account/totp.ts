// The TOTP provisioning address (UI 005 research R10): "Open in authenticator app" links to it only
// when it is an `otpauth://totp/` address (UI 001's `safeHref` stays http(s)-only).
export function isOtpauthUri(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^otpauth:\/\/totp\/[^\s]+$/i.test(value)
}
