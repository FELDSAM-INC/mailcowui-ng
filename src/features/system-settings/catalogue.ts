// UI 013 FR-004: catalogue order is stable as slices add their pages. Only registered pages are
// linked by the overview, so a partly delivered feature never exposes a dead link.
import type { AuditTargetType, SettingsCapabilities } from '@/api'
import { legacy, type TextRef } from '@/i18n'

export const settingsGroups = [
  'branding',
  'passwords',
  'notifications',
  'spam-filtering',
  'mail-filtering',
  'integrations',
  'mass-mail',
] as const
export interface SettingsPage {
  id: string
  group: (typeof settingsGroups)[number]
  routeName: string
  title: TextRef
  description: string
  auditTarget: AuditTargetType
  visible: (caps: SettingsCapabilities) => boolean
}
export const settingsPages: readonly SettingsPage[] = [
  {
    id: 'password-policy',
    group: 'passwords',
    routeName: 'system-settings-password-policy',
    title: legacy('admin.password_settings'),
    description: 'systemSettings.passwordPolicy.description',
    auditTarget: 'passwordPolicy',
    visible: () => true,
  },
  {
    id: 'rspamd-web-interface',
    group: 'spam-filtering',
    routeName: 'system-settings-rspamd-web-interface',
    title: 'nav.rspamdUi',
    description: 'systemSettings.rspamdUi.description',
    auditTarget: 'rspamdUiPassword',
    visible: () => true,
  },
  {
    id: 'ip-check',
    group: 'integrations',
    routeName: 'system-settings-ip-check',
    title: legacy('admin.ip_check'),
    description: 'systemSettings.ipCheck.description',
    auditTarget: 'ipCheck',
    visible: () => true,
  },
]
