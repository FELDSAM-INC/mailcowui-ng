// Who may open and change what in the Routing section (data-model §2 access predicates). Hiding is
// a convenience: the API enforces permissions and its refusals are handled (FR-003).
import type { Identity } from '@/api'

import { ROUTING_SCREENS, type RoutingScreen } from './screens'

type MaybeIdentity = Identity | null | undefined

const isAdmin = (identity: MaybeIdentity) => identity?.role === 'admin'
const isDomainAdmin = (identity: MaybeIdentity) => identity?.role === 'domainAdmin'

export function canOpenScreen(identity: MaybeIdentity, screen: RoutingScreen): boolean {
  return !!identity && screen.roles.includes(identity.role)
}

/** The available screens the identity may open, in navigation order. */
export function openScreens(identity: MaybeIdentity): RoutingScreen[] {
  return ROUTING_SCREENS.filter(
    (screen) => screen.status === 'available' && canOpenScreen(identity, screen),
  )
}

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
