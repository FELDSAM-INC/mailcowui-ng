// Passkey support detection (research R14, FR-010). When support is false, no passkey action is
// rendered and no error is shown.

type PublicKeyCredentialStatic = typeof PublicKeyCredential

/** The browser's `PublicKeyCredential`, or undefined when it does not exist. */
export function publicKeyCredential(): PublicKeyCredentialStatic | undefined {
  const value = (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential
  return typeof value === 'function' ? (value as PublicKeyCredentialStatic) : undefined
}

export function passkeysSupported(): boolean {
  return globalThis.isSecureContext === true && publicKeyCredential() !== undefined
}

export async function conditionalMediationAvailable(): Promise<boolean> {
  if (!passkeysSupported()) return false
  const check = (
    publicKeyCredential() as { isConditionalMediationAvailable?: () => Promise<boolean> }
  ).isConditionalMediationAvailable
  if (typeof check !== 'function') return false
  try {
    return (await check.call(publicKeyCredential())) === true
  } catch {
    return false
  }
}
