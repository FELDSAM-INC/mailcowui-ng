import type { Identity } from '@/api'

export type ActingTarget =
  | { kind: 'mailboxUser'; address: string; domain: string }
  | { kind: 'domainAdmin'; username: string }

export function canSignInAs(identity: Identity | null | undefined, target: ActingTarget): boolean {
  if (!identity || identity.impersonation || identity.pendingActions.length) return false
  if (identity.role === 'admin') return true
  return (
    identity.role === 'domainAdmin' &&
    target.kind === 'mailboxUser' &&
    identity.permissions.loginAs &&
    identity.scope.type === 'domains' &&
    identity.scope.domains.includes(target.domain)
  )
}
