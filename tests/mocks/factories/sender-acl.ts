// Sender permission factory (UI 004 research R21, API research R14, R18): `sender_acl` rows of a
// mailbox and the version tag over its sorted `[external, send_as]` pairs.
import { createHash } from 'node:crypto'

import type { MockSenderAcl } from '../scenarios/state'

/** Explicit permissions (and external sender addresses) of a mailbox as stored rows. */
export function senderAclRows(
  mailbox: string,
  explicit: readonly string[],
  external: readonly string[] = [],
): MockSenderAcl[] {
  return [
    ...explicit.map((sendAs) => ({ mailbox, sendAs, external: false })),
    ...external.map((sendAs) => ({ mailbox, sendAs, external: true })),
  ]
}

/** The rows of one mailbox (compared ignoring letter case). */
export function rowsOf(rows: readonly MockSenderAcl[], mailbox: string): MockSenderAcl[] {
  const wanted = mailbox.toLowerCase()
  return rows.filter((row) => row.mailbox.toLowerCase() === wanted)
}

export function senderSettingsEtag(rows: readonly MockSenderAcl[], mailbox: string): string {
  const pairs = rowsOf(rows, mailbox)
    .map((row) => [row.external ? 1 : 0, row.sendAs] as const)
    .sort(
      (a, b) =>
        a[0] - b[0] ||
        a[1].toLowerCase().localeCompare(b[1].toLowerCase()) ||
        (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0),
    )
  const stored = ['mailboxSenderSettings', mailbox.toLowerCase(), pairs]
  return `"${createHash('sha256').update(JSON.stringify(stored)).digest('hex').slice(0, 24)}"`
}
