// The permission matrix of FR-002 (UI 002 research D24). Hiding is a convenience: the API
// enforces the same matrix and refuses with `attribute-not-permitted` or `forbidden`.
import type { Identity } from '@/api'

export const PATCHABLE_ATTRIBUTES = [
  'description',
  'active',
  'maxMailboxes',
  'maxAliases',
  'maxMailboxQuota',
  'domainQuota',
  'backupMx',
  'relayAllRecipients',
  'relayUnknownOnly',
  'globalAddressList',
  'tags',
] as const

export type EditableAttribute = (typeof PATCHABLE_ATTRIBUTES)[number]

export interface DomainPermissions {
  canCreate: boolean
  canDelete: boolean
  canBulk: boolean
  canManageTemplates: boolean
  /** Administrators and the domain's domain administrators edit the footer (FR-057). */
  canEditFooter: boolean
  canSeeDomainAdmins: boolean
  editable: ReadonlySet<EditableAttribute>
}

export function domainPermissions(identity: Identity | null | undefined): DomainPermissions {
  const admin = identity?.role === 'admin'
  const editable = new Set<EditableAttribute>()
  if (admin) for (const attribute of PATCHABLE_ATTRIBUTES) editable.add(attribute)
  else if (identity?.role === 'domainAdmin') {
    editable.add('globalAddressList')
    editable.add('tags')
    if (identity.permissions.domainDesc) editable.add('description')
  }
  return {
    canCreate: admin,
    canDelete: admin,
    canBulk: admin,
    canManageTemplates: admin,
    canEditFooter: admin || identity?.role === 'domainAdmin',
    canSeeDomainAdmins: admin,
    editable,
  }
}
