// The API data of this feature as the client returns it: generated types with their read-only
// markers unwrapped (`Readable`, constitution I: derived, never restated).
import type {
  Mailbox as MailboxSchema,
  MailboxCreated as MailboxCreatedSchema,
  MailboxDeletionPreview as MailboxDeletionPreviewSchema,
  MailboxProtocolAccess,
  MailboxRenamed as MailboxRenamedSchema,
  MailboxTemplate as MailboxTemplateSchema,
  MailboxUserPermissions,
  Readable,
} from '@/api'

export type Mailbox = Readable<MailboxSchema>
export type MailboxCreated = Readable<MailboxCreatedSchema>
export type MailboxRenamed = Readable<MailboxRenamedSchema>
export type MailboxTemplate = Readable<MailboxTemplateSchema>
export type MailboxDeletionPreview = Readable<MailboxDeletionPreviewSchema>

export type Protocol = keyof MailboxProtocolAccess
export type Permission = keyof MailboxUserPermissions

/** The protocols in legacy's order (`protocol_access` options). */
export const PROTOCOL_ORDER: readonly Protocol[] = [
  'imap',
  'pop3',
  'smtp',
  'sieve',
  'activeSync',
  'dav',
]

/** The address as people read it: the local part at the readable domain name. */
export const readableAddress = (mailbox: Pick<Mailbox, 'localPart' | 'domainUnicode'>) =>
  `${mailbox.localPart}@${mailbox.domainUnicode}`
