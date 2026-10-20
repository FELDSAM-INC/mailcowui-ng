// UI007: a new acting instance is a new identity even when username and role are unchanged.
// Shared by the transport replay guard and the application session protocol.
import type { Identity } from './generated/schema'
export function identityKey(
  identity: Pick<Identity, 'username' | 'role' | 'impersonation'> | null | undefined,
): string | null {
  return identity
    ? `${identity.username}|${identity.role}|${identity.impersonation?.id ?? ''}`
    : null
}
