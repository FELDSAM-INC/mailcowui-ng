// The columns of the wide mailbox list (UI 003 FR-008, data-model §2 and §4), from the classic
// `draw_mailbox_table()`: operational fields stay visible; secondary fields such as password
// changes appear in row details and can be promoted through the column chooser. Headers are legacy's keys, or legacy's
// hard-coded protocol names. The chosen optional columns are a device convenience in
// `mailcowui-ng.mailboxes.columns`; unknown ids are ignored and failing storage gives the defaults.
import type { LegacyKey } from '@/i18n'
import { localStore } from '@/shared/platform/storage'

import type { MailboxSort } from './labels'

export type ColumnId =
  | 'address'
  | 'quota'
  | 'lastMailLogin'
  | 'passwordChangedAt'
  | 'inUse'
  | 'messages'
  | 'status'
  | 'displayName'
  | 'domain'
  | 'authSource'
  | 'tlsEnforceInbound'
  | 'tlsEnforceOutbound'
  | 'smtp'
  | 'imap'
  | 'pop3'
  | 'sieve'
  | 'activeSync'
  | 'dav'
  | 'quarantineNotification'
  | 'quarantineCategory'
  | 'createdAt'
  | 'modifiedAt'
  | 'tags'

export interface ColumnSpec {
  id: ColumnId
  /** The legacy key of the header, or `text` for legacy's hard-coded header. */
  label?: LegacyKey
  text?: string
  sort?: MailboxSort
  default: boolean
}

/** Column order stays stable when a secondary field is promoted to the main row. */
export const COLUMNS: readonly ColumnSpec[] = [
  { id: 'address', label: 'mailbox.username', sort: 'address', default: true },
  { id: 'quota', label: 'mailbox.domain_quota', sort: 'quotaUsed', default: true },
  { id: 'lastMailLogin', label: 'mailbox.last_mail_login', sort: 'lastMailLogin', default: true },
  {
    id: 'passwordChangedAt',
    label: 'mailbox.last_pw_change',
    sort: 'passwordChangedAt',
    default: false,
  },
  { id: 'inUse', label: 'mailbox.in_use', sort: 'percentUsed', default: true },
  { id: 'messages', label: 'mailbox.msg_num', sort: 'messageCount', default: true },
  { id: 'status', label: 'mailbox.active', sort: 'status', default: true },
  { id: 'displayName', label: 'mailbox.fname', sort: 'displayName', default: false },
  { id: 'domain', label: 'mailbox.domain', sort: 'domain', default: false },
  { id: 'authSource', label: 'mailbox.iam', default: false },
  { id: 'tlsEnforceInbound', label: 'mailbox.tls_enforce_in', default: false },
  { id: 'tlsEnforceOutbound', label: 'mailbox.tls_enforce_out', default: false },
  { id: 'smtp', text: 'SMTP', default: false },
  { id: 'imap', text: 'IMAP', default: false },
  { id: 'pop3', text: 'POP3', default: false },
  { id: 'sieve', text: 'SIEVE', default: false },
  { id: 'activeSync', text: 'EAS', default: false },
  { id: 'dav', text: 'DAV', default: false },
  { id: 'quarantineNotification', label: 'mailbox.quarantine_notification', default: false },
  { id: 'quarantineCategory', label: 'mailbox.quarantine_category', default: false },
  { id: 'createdAt', label: 'mailbox.created_on', sort: 'createdAt', default: false },
  { id: 'modifiedAt', label: 'mailbox.last_modified', sort: 'modifiedAt', default: false },
  { id: 'tags', label: 'add.tags', default: false },
]

export const OPTIONAL_COLUMNS: readonly ColumnId[] = COLUMNS.filter(
  (column) => !column.default,
).map((column) => column.id)

const KEY = 'mailcowui-ng.mailboxes.columns'

/** The optional columns shown, in catalogue order. */
export function readColumns(): ColumnId[] {
  const raw = localStore.get(KEY)
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const chosen = new Set(parsed.filter((value): value is string => typeof value === 'string'))
  return OPTIONAL_COLUMNS.filter((id) => chosen.has(id))
}

export function writeColumns(columns: readonly ColumnId[]): void {
  const chosen = new Set(columns)
  localStore.set(KEY, JSON.stringify(OPTIONAL_COLUMNS.filter((id) => chosen.has(id))))
}
