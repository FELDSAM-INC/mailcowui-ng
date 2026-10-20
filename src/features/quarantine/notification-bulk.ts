// The mailbox list's quarantine notification mass action (UI 006 US3, FR-041, legacy form map
// screen 4, D21): one menu group under `mailbox.quarantine_notification` with legacy's seven
// options in legacy order, the frequencies, a divider, then the categories. Targets carry no
// version (research R16).
import type {
  QuarantineNotificationBulkRequest,
  QuarantineNotificationCategory,
  QuarantineNotificationFrequency,
} from '@/api'
import type { LegacyKey } from '@/i18n'

export type NotificationBulkChoice =
  { frequency: QuarantineNotificationFrequency } | { category: QuarantineNotificationCategory }

export interface NotificationBulkOption {
  choice: NotificationBulkChoice
  labelKey: LegacyKey
  /** `data-bulk-action` of the menu item. */
  id: string
}

/** Legacy's order: hourly, daily, weekly, never | rejected, junk folder, all categories. */
export const NOTIFICATION_BULK_OPTIONS: readonly (readonly NotificationBulkOption[])[] = [
  [
    { choice: { frequency: 'hourly' }, labelKey: 'user.hourly', id: 'notify-hourly' },
    { choice: { frequency: 'daily' }, labelKey: 'user.daily', id: 'notify-daily' },
    { choice: { frequency: 'weekly' }, labelKey: 'user.weekly', id: 'notify-weekly' },
    { choice: { frequency: 'never' }, labelKey: 'user.never', id: 'notify-never' },
  ],
  [
    { choice: { category: 'rejected' }, labelKey: 'user.q_reject', id: 'category-rejected' },
    { choice: { category: 'junk' }, labelKey: 'user.q_add_header', id: 'category-junk' },
    { choice: { category: 'all' }, labelKey: 'user.q_all', id: 'category-all' },
  ],
]

/** The option of a choice (for its label). */
export function notificationBulkOption(choice: NotificationBulkChoice): NotificationBulkOption {
  const all = NOTIFICATION_BULK_OPTIONS.flat()
  return all.find((option) =>
    'frequency' in choice
      ? 'frequency' in option.choice && option.choice.frequency === choice.frequency
      : 'category' in option.choice && option.choice.category === choice.category,
  )!
}

/** The confirmation's title: legacy's header of the setting the choice changes. */
export const notificationBulkTitleKey = (choice: NotificationBulkChoice): LegacyKey =>
  'frequency' in choice ? 'mailbox.quarantine_notification' : 'mailbox.quarantine_category'

export function notificationBulkRequest(
  choice: NotificationBulkChoice,
  mailboxes: readonly string[],
): QuarantineNotificationBulkRequest {
  return { ...choice, targets: mailboxes.map((id) => ({ id })) }
}
