// Mail settings of a mailbox (UI 005 T011, research R16): the version tag of tagged-mail handling
// and TLS enforcement, which the mailbox's `mailSettingsVersion` reports and the bulk TLS change
// compares (API gap AG1, closed by G22).
import { createHash } from 'node:crypto'

import type { MockMailbox } from '../scenarios/state'

type MailSettingsSource = Pick<
  MockMailbox,
  'taggedMailHandling' | 'tlsEnforceInbound' | 'tlsEnforceOutbound'
>

/** The `etag` of `GET /mailboxes/{mailbox}/mail-settings`, equal to `Mailbox.mailSettingsVersion`. */
export function mailSettingsEtag(mailbox: MailSettingsSource): string {
  const stored = [mailbox.taggedMailHandling, mailbox.tlsEnforceInbound, mailbox.tlsEnforceOutbound]
  return `"s${createHash('sha256').update(JSON.stringify(stored)).digest('hex').slice(0, 23)}"`
}
