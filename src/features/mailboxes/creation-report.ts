// The outcomes of a creation (docs/conventions.md "Outcomes"): legacy's `success.mailbox_added`
// with the address, and one warning per follow-up step that failed, which legacy reports only in
// its log (new strings).
import type { MailboxCreationReport } from '@/api'
import { legacy } from '@/i18n'

import type { MailboxFlash } from './flash'
import type { MailboxCreated } from './types'

const STEPS = [
  'groupwareDirectoryUpdate',
  'rateLimit',
  'taggedMailHandling',
] as const satisfies readonly (keyof MailboxCreationReport)[]

export function creationFlashes(created: MailboxCreated): MailboxFlash[] {
  return [
    { kind: 'success', text: legacy('success.mailbox_added', created.address) },
    ...STEPS.filter((step) => created.creationReport[step] === 'failed').map((step) => ({
      kind: 'warning' as const,
      text: `mailboxes.creationReport.${step}`,
    })),
  ]
}
