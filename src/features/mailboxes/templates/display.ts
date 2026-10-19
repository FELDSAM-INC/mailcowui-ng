// Labels and display values of mailbox template values, for the template list (the classic
// columns, "∞" for an unlimited quota and no rate limit), the read-only view of domain
// administrators and the outdated notice of the edit form ("now saved as …"), with the labels of
// the template form.
import { useI18n } from 'vue-i18n'

import type { MailboxRateLimit } from '@/api'
import { lt, type LegacyKey } from '@/i18n'
import { useFormat } from '@/i18n/format'

import {
  templateColumns,
  COLUMN_PROTOCOLS,
  protocolColumnKey,
} from '../components/templates/template-columns'
import {
  FRAME_KEYS,
  QUARANTINE_CATEGORY_OPTIONS,
  QUARANTINE_NOTIFICATION_OPTIONS,
  TAGGED_MAIL_OPTIONS,
} from '../components/fields/options'
import { FIELD_LABEL_KEYS, useMailboxFieldDisplay } from '../field-display'
import type { MailboxTemplate } from '../types'

/** The template form's labels of the values the mailbox page labels differently or lacks. */
const TEMPLATE_LABEL_KEYS: Readonly<Record<string, LegacyKey>> = {
  ...FIELD_LABEL_KEYS,
  name: 'mailbox.template',
  taggedMailHandling: 'user.tag_handling',
  quarantineNotification: 'user.quarantine_notification',
  quarantineCategory: 'user.quarantine_category',
  tlsEnforceInbound: 'user.tls_enforce_in',
  tlsEnforceOutbound: 'user.tls_enforce_out',
  rateLimit: 'acl.ratelimit',
}

const OPTIONS: Readonly<Record<string, readonly { value: string; labelKey: LegacyKey }[]>> = {
  taggedMailHandling: TAGGED_MAIL_OPTIONS,
  quarantineNotification: QUARANTINE_NOTIFICATION_OPTIONS,
  quarantineCategory: QUARANTINE_CATEGORY_OPTIONS,
}

export function useTemplateDisplay() {
  const { t } = useI18n()
  const fmt = useFormat()
  const fields = useMailboxFieldDisplay()

  const option = (field: string, value: string) => {
    const found = OPTIONS[field]?.find((item) => item.value === value)
    return found ? lt(found.labelKey) : value
  }

  /** Legacy's "∞" without a rate limit; the form says "Disabled" (`none`). */
  const rateLimit = (limit: MailboxRateLimit | null, none = '∞') =>
    limit ? `${fmt.number(limit.value)} ${lt(FRAME_KEYS[limit.frame])}` : none

  /** The allowed protocols on one line, by the classic column headers. */
  const protocols = (template: MailboxTemplate) => {
    const allowed = COLUMN_PROTOCOLS.filter((key) => template.protocolAccess[key])
    return allowed.length > 0
      ? fmt.list(allowed.map((key) => t(protocolColumnKey(key))))
      : t('domains.values.none')
  }

  const label = (field: string) => {
    if (field === 'userPermissions') return t('mailboxes.acl.label')
    const key = TEMPLATE_LABEL_KEYS[field]
    return key ? lt(key) : field
  }

  function value(field: string, raw: unknown): string {
    if (field in OPTIONS) return option(field, raw as string)
    if (field === 'rateLimit')
      return rateLimit(raw as MailboxRateLimit | null, lt('ratelimit.disabled'))
    return fields.value(field, raw)
  }

  function changes(changed: readonly { field: string; savedValue: unknown }[] | null) {
    return (
      changed?.map((item) => ({
        field: item.field,
        label: label(item.field),
        saved: value(item.field, item.savedValue),
      })) ?? null
    )
  }

  return {
    columns: () => templateColumns(fields, t),
    quota: fields.quota,
    yesNo: fields.yesNo,
    option,
    rateLimit,
    protocols,
    label,
    value,
    changes,
  }
}
