// The permission matrix of UI 004 (spec FR-002, research R6): pure functions over the identity of
// API 001 and, where FR-002 needs it, the feature's capabilities. Hiding a control is a convenience;
// the API enforces every permission.
import type { AliasCapabilities, Identity } from '@/api'

export interface Feature004Permissions {
  /** The three screens: administrators and domain administrators. */
  canView: boolean
  canManageAliases: boolean
  canManageAliasDomains: boolean
  canManageResources: boolean
  canEditSendAs: boolean
  /** Domain administrators need `aliasDomains`. */
  canAddAliasDomain: boolean
  /** Domain administrators need `ratelimit`. */
  canSetInitialRateLimit: boolean
  /** External destinations get the advance notice (FR-020). */
  externalDestinationsRestricted: boolean
  /** The `*` entry of "Allow to send as": administrators only. */
  canGrantAnyAddress: boolean
  /** Domain administrators need `extendSenderAcl`. */
  canEditExternalSenderAddresses: boolean
  canSeeHistory: boolean
  canSeeOrphaned: boolean
}

export function feature004Permissions(
  identity: Identity | null | undefined,
  capabilities: AliasCapabilities | null | undefined,
): Feature004Permissions {
  const admin = identity?.role === 'admin'
  const manager = admin || identity?.role === 'domainAdmin'
  const flag = (name: keyof Identity['permissions']) =>
    admin || (manager && !!identity?.permissions[name])
  return {
    canView: manager,
    canManageAliases: manager,
    canManageAliasDomains: manager,
    canManageResources: manager,
    canEditSendAs: manager,
    canAddAliasDomain: flag('aliasDomains'),
    canSetInitialRateLimit: flag('ratelimit'),
    externalDestinationsRestricted:
      manager && (!!capabilities?.externalDestinationsDisabled || !flag('aliasExternalGoto')),
    canGrantAnyAddress: admin,
    canEditExternalSenderAddresses: flag('extendSenderAcl'),
    canSeeHistory: admin,
    canSeeOrphaned: admin,
  }
}
