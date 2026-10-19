// Who may change what in the Routing section (data-model §2 access predicates); which screens an
// identity may open is in `screens.ts`. Hiding is a convenience: the API enforces permissions and
// its refusals are handled (FR-003). This module imports no screen data, so that the relayhost
// field of the domain and mailbox sections keeps the screens out of the start-up bundle.
import type { Identity } from '@/api'

export type MaybeIdentity = Identity | null | undefined

const isAdmin = (identity: MaybeIdentity) => identity?.role === 'admin'
const isDomainAdmin = (identity: MaybeIdentity) => identity?.role === 'domainAdmin'

export const canWriteRouting = isAdmin

export function canWriteBccMaps(identity: MaybeIdentity): boolean {
  return isAdmin(identity) || (isDomainAdmin(identity) && !!identity?.permissions.bccMaps)
}

export function canEditDomainRelayhost(identity: MaybeIdentity): boolean {
  return isAdmin(identity) || (isDomainAdmin(identity) && !!identity?.permissions.domainRelayhost)
}

export function canEditMailboxRelayhost(identity: MaybeIdentity): boolean {
  return isAdmin(identity) || (isDomainAdmin(identity) && !!identity?.permissions.mailboxRelayhost)
}

export function canListRelayhostChoices(identity: MaybeIdentity): boolean {
  return canEditDomainRelayhost(identity) || canEditMailboxRelayhost(identity)
}

export const canSeeHistory = isAdmin
