// Labels and display values of mailbox fields, for the outdated notice of a section ("now saved as
// …", FR-044) and the read-only views: the legacy label of each field and its value as legacy shows
// it (quotas in binary units with "∞" for unlimited, options by their legacy labels).
import { useI18n } from 'vue-i18n'

import type { MailboxAuthSource, MailboxProtocolAccess, MailboxStatus } from '@/api'
import { useBranding } from '@/app/branding/public-config'
import { lt, text, type LegacyKey } from '@/i18n'
import { useFormat } from '@/i18n/format'

import { PERMISSION_LABEL_KEYS, PERMISSION_ORDER } from './acl'
import { authSourceLabelKey } from './auth-source'
import { protocolKey } from './components/fields/options'
import { statusLabelKey } from './labels'
import { PROTOCOL_ORDER } from './types'

export const FIELD_LABEL_KEYS: Readonly<Record<string, LegacyKey>> = {
  authSource: 'admin.iam',
  displayName: 'edit.full_name',
  tags: 'add.tags',
  quota: 'edit.quota_mb',
  password: 'edit.password',
  recoveryEmail: 'edit.password_recovery_email',
  protocolAccess: 'edit.allowed_protocols',
  status: 'mailbox.status',
  forcePasswordChange: 'edit.force_pw_update',
  forceSecondFactorSetup: 'tfa.force_tfa',
  webmailRedirect: 'edit.sogo_access',
  userPermissions: 'edit.acl',
  customAttributes: 'edit.custom_attributes',
}

export function useMailboxFieldDisplay() {
  const { t } = useI18n()
  const fmt = useFormat()
  const { branding } = useBranding()

  const label = (field: string) => {
    const key = FIELD_LABEL_KEYS[field.split('.')[0] ?? field]
    return key ? lt(key) : field
  }

  const quota = (bytes: number) => (bytes === 0 ? '∞' : fmt.bytes(bytes, { exact: true }))
  const yesNo = (value: boolean) => t(value ? 'domains.values.yes' : 'domains.values.no')
  const source = (value: MailboxAuthSource) => {
    const key = authSourceLabelKey(value)
    return key ? t(key) : branding.value.productName
  }

  function value(field: string, raw: unknown): string {
    switch (field) {
      case 'quota':
        return typeof raw === 'number' ? quota(raw) : ''
      case 'status':
        return text(statusLabelKey(raw as MailboxStatus))
      case 'authSource':
        return source(raw as MailboxAuthSource)
      case 'protocolAccess': {
        const access = raw as MailboxProtocolAccess
        return fmt.list(
          PROTOCOL_ORDER.filter((key) => access[key]).map((key) => t(protocolKey(key))),
        )
      }
      case 'userPermissions': {
        const permissions = raw as Record<string, boolean>
        return fmt.list(
          PERMISSION_ORDER.filter((key) => permissions[key]).map((key) =>
            lt(PERMISSION_LABEL_KEYS[key]),
          ),
        )
      }
      case 'customAttributes':
        return Object.entries(raw as Record<string, string>)
          .map(([name, val]) => `${name}=${val}`)
          .join(', ')
    }
    if (typeof raw === 'boolean') return yesNo(raw)
    if (Array.isArray(raw))
      return raw.length > 0 ? fmt.list(raw.map(String)) : t('domains.values.none')
    if (raw === null || raw === undefined || raw === '') return t('domains.values.none')
    return typeof raw === 'string' || typeof raw === 'number' ? String(raw) : JSON.stringify(raw)
  }

  function changes(fields: readonly { field: string; savedValue: unknown }[] | null) {
    return (
      fields?.map((item) => ({
        field: item.field,
        label: label(item.field),
        saved: value(item.field, item.savedValue),
      })) ?? null
    )
  }

  return { label, value, changes, quota, yesNo, source }
}
