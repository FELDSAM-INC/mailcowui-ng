// The option labels of the classic mailbox forms, by the API's values (legacy keys verbatim; the
// texts legacy hard-codes are new strings equal to them).
import type {
  MailboxQuarantineCategory,
  MailboxQuarantineNotification,
  MailboxRateLimit,
  MailboxStatus,
  MailboxTaggedMailHandling,
} from '@/api'
import type { LegacyKey } from '@/i18n'

import type { Protocol } from '../../types'

export const TAGGED_MAIL_OPTIONS: readonly {
  value: MailboxTaggedMailHandling
  labelKey: LegacyKey
}[] = [
  { value: 'subfolder', labelKey: 'user.tag_in_subfolder' },
  { value: 'subject', labelKey: 'user.tag_in_subject' },
  { value: 'none', labelKey: 'user.tag_in_none' },
]

export const QUARANTINE_NOTIFICATION_OPTIONS: readonly {
  value: MailboxQuarantineNotification
  labelKey: LegacyKey
}[] = [
  { value: 'never', labelKey: 'user.never' },
  { value: 'hourly', labelKey: 'user.hourly' },
  { value: 'daily', labelKey: 'user.daily' },
  { value: 'weekly', labelKey: 'user.weekly' },
]

export const QUARANTINE_CATEGORY_OPTIONS: readonly {
  value: MailboxQuarantineCategory
  labelKey: LegacyKey
}[] = [
  { value: 'rejected', labelKey: 'user.q_reject' },
  { value: 'junk', labelKey: 'user.q_add_header' },
  { value: 'all', labelKey: 'user.q_all' },
]

/** The status select: `add.*` on the add form, `edit.*` on the edit forms. */
export const STATUS_KEYS: Record<'add' | 'edit', Record<MailboxStatus, LegacyKey>> = {
  add: { active: 'add.active', loginDisabled: 'add.disable_login', inactive: 'add.inactive' },
  edit: { active: 'edit.active', loginDisabled: 'edit.disable_login', inactive: 'edit.inactive' },
}

export const FRAME_KEYS: Record<MailboxRateLimit['frame'], LegacyKey> = {
  second: 'ratelimit.second',
  minute: 'ratelimit.minute',
  hour: 'ratelimit.hour',
  day: 'ratelimit.day',
}

/** The protocol options of the forms (hard-coded in legacy). */
export const protocolKey = (protocol: Protocol) => `mailboxes.protocol.${protocol}`
