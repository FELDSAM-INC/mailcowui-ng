// The mailbox mass actions (US6, FR-053, the classic list's `mass-actions-mailbox` menus): the
// "Mailbox" group (activate, disallow login, deactivate, remove) and the "Allowed protocols" group
// (activate or deactivate each protocol, labelled as legacy hard-codes them), left out for a domain
// administrator without `protocolAccess`. Targets carry each mailbox's version tag as listed.
import type { BulkTarget, MailboxBulkActionRequest } from '@/api'
import type { LegacyKey } from '@/i18n'

import { readableAddress, type Mailbox, type Protocol } from './types'

export type MailboxBulkChoice =
  | { action: 'activate' | 'disableLogin' | 'deactivate' | 'delete' }
  | { action: 'allowProtocol' | 'disallowProtocol'; protocol: Protocol }

/** The "Mailbox" group in legacy's order, with legacy's labels. */
export const STATUS_ACTIONS: readonly {
  action: 'activate' | 'disableLogin' | 'deactivate'
  label: LegacyKey
}[] = [
  { action: 'activate', label: 'mailbox.activate' },
  { action: 'disableLogin', label: 'mailbox.disable_login' },
  { action: 'deactivate', label: 'mailbox.deactivate' },
]

/** The "Allowed protocols" group in legacy's order; legacy hard-codes these headers. */
export const PROTOCOL_HEADERS: readonly { protocol: Protocol; text: string }[] = [
  { protocol: 'imap', text: 'IMAP' },
  { protocol: 'pop3', text: 'POP3' },
  { protocol: 'smtp', text: 'SMTP' },
  { protocol: 'sieve', text: 'Sieve' },
  { protocol: 'activeSync', text: 'ActiveSync (EAS)' },
  { protocol: 'dav', text: 'CalDAV/CardDAV (DAV)' },
]

export const protocolHeader = (protocol: Protocol) =>
  PROTOCOL_HEADERS.find((item) => item.protocol === protocol)?.text ?? protocol

/** Actions that take something away need one explicit confirmation; deletion a typed count. */
export function confirmationOf(choice: MailboxBulkChoice): 'none' | 'confirm' | 'typed' {
  if (choice.action === 'delete') return 'typed'
  if (choice.action === 'activate' || choice.action === 'allowProtocol') return 'none'
  return 'confirm'
}

export function bulkRequest(
  choice: MailboxBulkChoice,
  mailboxes: readonly Pick<Mailbox, 'address' | 'etag'>[],
): MailboxBulkActionRequest {
  const targets: BulkTarget[] = mailboxes.map((mailbox) => ({
    id: mailbox.address,
    version: mailbox.etag,
  }))
  return 'protocol' in choice
    ? { action: choice.action, protocol: choice.protocol, targets }
    : { action: choice.action, targets }
}

/** The entries of the result rows: the address, shown readable. */
export const bulkEntries = (mailboxes: readonly Mailbox[]) =>
  mailboxes.map((mailbox) => ({ name: mailbox.address, unicodeName: readableAddress(mailbox) }))
