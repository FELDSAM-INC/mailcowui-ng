import type {
  QuotaNotificationSettings,
  QuotaNotificationSettingsPatch,
  QuotaNotificationRecipients,
  QuotaNotificationRecipientsPatch,
} from '@/api'
import { parseEntryList } from '@/shared/validation/entry-list'
import { QUOTA_COPY_RECIPIENT_MAX_LENGTH } from '@/shared/validation/limits'

export const quotaFields = ['sender', 'subject', 'htmlTemplate'] as const
export function quotaDraft(value: QuotaNotificationSettings) {
  return { sender: value.sender, subject: value.subject, htmlTemplate: value.htmlTemplate }
}
export function quotaPatch(
  draft: ReturnType<typeof quotaDraft>,
  base: QuotaNotificationSettings,
): QuotaNotificationSettingsPatch | null {
  const patch: QuotaNotificationSettingsPatch = {}
  for (const key of quotaFields) if (draft[key] !== base[key]) patch[key] = draft[key]
  return Object.keys(patch).length ? patch : null
}
export function copiesDraft(value: QuotaNotificationRecipients) {
  return { recipients: value.recipients.join('\n'), active: value.active }
}
export function copiesPatch(
  draft: ReturnType<typeof copiesDraft>,
  base: QuotaNotificationRecipients,
): QuotaNotificationRecipientsPatch | null {
  const recipients = parseEntryList(draft.recipients).map((entry) => entry.value)
  if (
    JSON.stringify(recipients) === JSON.stringify(base.recipients) &&
    draft.active === base.active
  )
    return null
  return { recipients, active: draft.active }
}
export function validateCopies(draft: ReturnType<typeof copiesDraft>, limit: number) {
  const entries = parseEntryList(draft.recipients)
  const errors: Record<string, string> = {}
  if (entries.length > limit) errors.recipients = 'validation.tooMany'
  for (const { value, index } of entries) {
    if (value.length > QUOTA_COPY_RECIPIENT_MAX_LENGTH)
      errors[`recipients.${index}`] = 'validation.tooLong'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /[\u0000-\u001f\u007f]/.test(value))
      errors[`recipients.${index}`] = 'validation.format.email'
  }
  return errors
}
