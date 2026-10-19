// The outcome alerts an action leaves for the mailbox page it opens (docs/conventions.md
// "Outcomes"): legacy's `success.mailbox_renamed` after a rename, `success.mailbox_added` and the
// creation report after a creation. Shown once, then forgotten.
import type { TextRef } from '@/i18n'

export interface MailboxFlash {
  kind: 'success' | 'warning' | 'danger'
  text: TextRef
}

const flashes = new Map<string, MailboxFlash[]>()

export function setMailboxFlash(address: string, messages: MailboxFlash[]): void {
  flashes.set(address.toLowerCase(), messages)
}

export function takeMailboxFlash(address: string): MailboxFlash[] {
  const key = address.toLowerCase()
  const messages = flashes.get(key) ?? []
  flashes.delete(key)
  return messages
}
