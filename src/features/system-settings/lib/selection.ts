import type { MassMailSelection } from '@/api'
import { isEmailAddress } from '@/shared/validation/email'

export interface SelectionDraft {
  scope: 'all' | 'domains'
  domains: string[]
  listMode: 'none' | 'include' | 'exclude'
  mailboxes: string[]
}
export interface MessageDraft {
  sender: string
  subject: string
  textBody: string
  htmlBody: string
}
const unique = (items: readonly string[]) => [
  ...new Set(items.map((item) => item.trim().toLowerCase()).filter(Boolean)),
]

/** Keep request order so the API's entry indexes still identify the visible entries. */
export function normaliseSelection(selection: MassMailSelection): MassMailSelection {
  return Object.fromEntries(
    Object.entries(selection).map(([field, values]) => [field, unique(values)]),
  )
}
export function selectionKey(selection: MassMailSelection): string {
  const normalised = normaliseSelection(selection)
  return JSON.stringify(
    Object.fromEntries(
      ['domains', 'include', 'exclude'].flatMap((field) => {
        const values = normalised[field as keyof MassMailSelection]
        return values === undefined ? [] : [[field, [...values].sort()]]
      }),
    ),
  )
}
export function selectionFromDraft(draft: SelectionDraft): MassMailSelection {
  return normaliseSelection({
    ...(draft.scope === 'domains' ? { domains: draft.domains } : {}),
    ...(draft.listMode !== 'none' ? { [draft.listMode]: draft.mailboxes } : {}),
  })
}
export function validateMassMail(draft: MessageDraft, maxBytes: number) {
  const errors: Partial<
    Record<
      keyof MessageDraft,
      'sender' | 'subject' | 'subjectSingleLine' | 'subjectTooLong' | 'textBody' | 'bodyTooLong'
    >
  > = {}
  if (!isEmailAddress(draft.sender) || draft.sender.length > 255) errors.sender = 'sender'
  if (!draft.subject.trim()) errors.subject = 'subject'
  else if (/[\u0000-\u001f\u007f]/.test(draft.subject)) errors.subject = 'subjectSingleLine'
  else if ([...draft.subject].length > 255) errors.subject = 'subjectTooLong'
  if (!draft.textBody.trim()) errors.textBody = 'textBody'
  for (const field of ['textBody', 'htmlBody'] as const)
    if (new TextEncoder().encode(draft[field]).length > maxBytes) errors[field] = 'bodyTooLong'
  return errors
}
const failureCodes = new Set([
  'overQuota',
  'mailboxUnavailable',
  'rejected',
  'temporaryFailurePersisted',
  'connectionFailed',
  'interrupted',
])
/** Server replies are not UI messages; unknown future codes use the generic refusal label. */
export const failureLabel = (code: string | null) =>
  code && failureCodes.has(code) ? code : 'rejected'
