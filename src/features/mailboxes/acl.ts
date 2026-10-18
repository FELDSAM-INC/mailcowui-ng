// Domain administrator gating (research R11, FR-003, FR-041, FR-042, SC-010). Hiding or locking a
// control is a convenience; the API enforces the same flags and every refusal is still handled.
// Locked controls show their value with legacy's "Prohibited by ACL" (`acl.prohibited`) and the
// permission's `acl.*` label, as the classic `data-acl="0"` controls do.
import type { Identity, MailboxUserPermissions, PermissionFlags } from '@/api'
import type { LegacyKey } from '@/i18n'

import type { Permission } from './types'

export type GatedFlag = 'protocolAccess' | 'sogoAccess' | 'ratelimit' | 'unlimitedQuota'

export type Gate = { state: 'editable' } | { state: 'readOnly'; flag: GatedFlag }

const FIELD_FLAGS = {
  protocolAccess: 'protocolAccess',
  webmailRedirect: 'sogoAccess',
  rateLimit: 'ratelimit',
} as const satisfies Record<string, GatedFlag>

export type GatedField = keyof typeof FIELD_FLAGS

export function gate(field: GatedField, identity: Identity | null | undefined): Gate {
  if (identity?.role === 'admin') return { state: 'editable' }
  const flag = FIELD_FLAGS[field]
  return identity?.permissions[flag] ? { state: 'editable' } : { state: 'readOnly', flag }
}

/** Whether 0 (unlimited) may be entered: the flag, or a mailbox that already is unlimited. */
export function canSetUnlimited(
  identity: Identity | null | undefined,
  currentQuota?: number,
): boolean {
  return identity?.role === 'admin' || !!identity?.permissions.unlimitedQuota || currentQuota === 0
}

/** The bulk protocol actions need `protocolAccess` (FR-053). */
export const canBulkProtocols = (identity: Identity | null | undefined) =>
  gate('protocolAccess', identity).state === 'editable'

/** Legacy shows the relayhost to administrators and with `mailbox_relayhost`. */
export const canSeeRelayhost = (identity: Identity | null | undefined) =>
  identity?.role === 'admin' || !!identity?.permissions.mailboxRelayhost

/** The legacy label of each flag a refusal can name. */
export const FLAG_LABEL_KEYS: Partial<Record<keyof PermissionFlags, LegacyKey>> = {
  protocolAccess: 'acl.protocol_access',
  sogoAccess: 'acl.sogo_access',
  ratelimit: 'acl.ratelimit',
  unlimitedQuota: 'acl.unlimited_quota',
  syncjobs: 'acl.syncjobs',
  quarantine: 'acl.quarantine',
  appPasswds: 'acl.app_passwds',
  pushover: 'acl.pushover',
  spamPolicy: 'acl.spam_policy',
}

/** The user permissions in legacy's order (the ACL multi-select). */
export const PERMISSION_ORDER: readonly Permission[] = [
  'spamAlias',
  'tlsPolicy',
  'spamScore',
  'spamPolicy',
  'delimiterAction',
  'syncjobs',
  'easReset',
  'sogoProfileReset',
  'pushover',
  'quarantine',
  'quarantineAttachments',
  'quarantineNotification',
  'quarantineCategory',
  'appPasswds',
  'pwReset',
]

export const PERMISSION_LABEL_KEYS: Record<Permission, LegacyKey> = {
  spamAlias: 'acl.spam_alias',
  tlsPolicy: 'acl.tls_policy',
  spamScore: 'acl.spam_score',
  spamPolicy: 'acl.spam_policy',
  delimiterAction: 'acl.delimiter_action',
  syncjobs: 'acl.syncjobs',
  easReset: 'acl.eas_reset',
  sogoProfileReset: 'acl.sogo_profile_reset',
  pushover: 'acl.pushover',
  quarantine: 'acl.quarantine',
  quarantineAttachments: 'acl.quarantine_attachments',
  quarantineNotification: 'acl.quarantine_notification',
  quarantineCategory: 'acl.quarantine_category',
  appPasswds: 'acl.app_passwds',
  pwReset: 'acl.pw_reset',
}

/** The permissions the API returned (domain administrators lack some, FR-042), in legacy order. */
export function presentPermissions(permissions: Partial<MailboxUserPermissions>): Permission[] {
  return PERMISSION_ORDER.filter((key) => key in permissions)
}
