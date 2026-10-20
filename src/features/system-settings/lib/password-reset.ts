import type { PasswordResetNotification, PasswordResetNotificationPatch } from '@/api'
import { isEmailAddress } from '@/shared/validation/email'

export const notificationFields = ['sender', 'subject', 'textTemplate', 'htmlTemplate'] as const
export type NotificationDraft = Pick<PasswordResetNotification, (typeof notificationFields)[number]>
export function notificationDraft(saved: PasswordResetNotification): NotificationDraft {
  return {
    sender: saved.sender,
    subject: saved.subject,
    textTemplate: saved.textTemplate,
    htmlTemplate: saved.htmlTemplate,
  }
}
export function notificationPatch(
  draft: NotificationDraft,
  opened: PasswordResetNotification,
): PasswordResetNotificationPatch | null {
  const patch: PasswordResetNotificationPatch = {}
  for (const field of notificationFields)
    if (draft[field] !== opened[field]) patch[field] = draft[field]
  // Default bodies are projected by GET, while their stored values are both empty. Editing
  // either makes the pair custom, so keep the other body the administrator can see in the form.
  if (opened.templatesAreDefault && ('textTemplate' in patch || 'htmlTemplate' in patch)) {
    patch.textTemplate = draft.textTemplate
    patch.htmlTemplate = draft.htmlTemplate
  }
  return Object.keys(patch).length ? patch : null
}
export function resetWarnings(draft: NotificationDraft) {
  const text = draft.textTemplate !== ''
  const html = draft.htmlTemplate !== ''
  return {
    missingLink:
      (text && !draft.textTemplate.includes('{{link}}')) ||
      (html && !draft.htmlTemplate.includes('{{link}}')),
    oneEmpty: text !== html,
    restoresDefaults: !text && !html,
  }
}
export const templateBytes = (value: string) => new TextEncoder().encode(value).byteLength
export function validateNotification(
  draft: NotificationDraft,
  maxBytes: number,
): Partial<Record<keyof NotificationDraft, string>> {
  const errors: Partial<Record<keyof NotificationDraft, string>> = {}
  if (draft.sender !== '' && !isEmailAddress(draft.sender))
    errors.sender = 'validation.format.email'
  if (/[\u0000-\u001f\u007f]/.test(draft.subject)) errors.subject = 'emailTemplate.singleLine'
  else if ([...draft.subject].length > 255) errors.subject = 'validation.tooLong'
  for (const field of ['textTemplate', 'htmlTemplate'] as const)
    if (templateBytes(draft[field]) > maxBytes) errors[field] = 'validation.tooLongBytes'
  return errors
}
