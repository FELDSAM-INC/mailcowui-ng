// A new sign-in or acting instance owns new private state even for the same username and role.
// Shared by the transport replay guard and the application session protocol. The session reference
// is not an authentication credential and is never persisted separately by the client.
import type { Identity } from './generated/schema'
export function identityKey(
  identity: Pick<Identity, 'username' | 'role' | 'impersonation' | 'sessionId'> | null | undefined,
): string | null {
  return identity
    ? `${identity.username}|${identity.role}|${identity.impersonation?.id ?? ''}|${identity.sessionId ?? ''}`
    : null
}
