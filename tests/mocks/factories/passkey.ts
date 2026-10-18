// Passkey factory: contract-valid `Passkey` objects plus the credential ID the mock recognises.
import type { MockPasskey } from '../scenarios/state'
import { hex, randomBase64url } from './ids'

let counter = 0

export function passkey(overrides: Partial<MockPasskey> = {}): MockPasskey {
  counter += 1
  return {
    id: hex(32),
    name: `Passkey ${counter}`,
    authenticatorDescription: 'iCloud Keychain',
    registeredAt: new Date(Date.UTC(2026, 8, 1 + (counter % 28), 9, 30)).toISOString(),
    hostName: 'localhost',
    active: true,
    etag: `"pk-${counter}"`,
    credentialId: randomBase64url(32),
    ...overrides,
  }
}

/** The public `Passkey` shape, without the mock-only credential ID. */
export function toPasskey({ credentialId: _credentialId, ...rest }: MockPasskey) {
  return rest
}
