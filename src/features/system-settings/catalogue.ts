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
    id: 'colours',
    group: 'branding',
    routeName: 'system-settings-colours',
    title: 'systemSettings.colours.title',
    description: 'systemSettings.colours.description',
    auditTarget: 'brandColors',
    visible: () => true,
  },
  {
    id: 'cors',
    group: 'integrations',
    routeName: 'system-settings-cors',
    title: legacy('admin.cors_settings'),
    description: 'systemSettings.cors.description',
    auditTarget: 'legacyApiCors',
    visible: () => true,
  },
  {
    id: 'license',
    group: 'integrations',
    routeName: 'system-settings-license',
    title: legacy('admin.guid_and_license'),
    description: 'systemSettings.license.description',
    auditTarget: 'license',
    visible: (caps) => caps.licenseVerificationEnabled,
  },
  {
    id: 'sign-in-page',
    group: 'branding',
    routeName: 'system-settings-sign-in-page',
    title: legacy('admin.login_page'),
    description: 'systemSettings.signInPage.description',
    auditTarget: 'loginPage',
    visible: () => true,
  },
  {
    id: 'app-links',
    group: 'branding',
    routeName: 'system-settings-app-links',
    title: legacy('admin.app_links'),
    description: 'systemSettings.appLinks.description',
    auditTarget: 'appLinks',
    visible: () => true,
  },
  {
    id: 'global-sieve',
    group: 'mail-filtering',
    routeName: 'system-settings-global-sieve',
    title: 'systemSettings.globalSieve.title',
    description: 'systemSettings.globalSieve.description',
    auditTarget: 'globalSieveFilter',
    visible: () => true,
  },
  {
    id: 'logos',
    group: 'branding',
    routeName: 'system-settings-logos',
    title: legacy('admin.change_logo'),
    description: 'systemSettings.logos.description',
    auditTarget: 'logo',
    visible: () => true,
  },
  {
    id: 'ui-texts',
    group: 'branding',
    routeName: 'system-settings-ui-texts',
    title: legacy('admin.ui_texts'),
    description: 'systemSettings.uiTexts.description',
    auditTarget: 'uiTexts',
    visible: () => true,
  },
  {
    id: 'mass-mail-send',
    group: 'mass-mail',
    routeName: 'system-settings-mass-mail-send',
    title: legacy('admin.sys_mails'),
    description: 'systemSettings.massMail.description',
    auditTarget: 'massMailJob',
    visible: () => true,
  },
  {
    id: 'quota-notifications',
    group: 'notifications',
    routeName: 'system-settings-quota-notifications',
    title: legacy('admin.quota_notifications'),
    description: 'systemSettings.quota.description',
    auditTarget: 'quotaNotification',
    visible: () => true,
  },
  {
    id: 'rspamd-rules',
    group: 'spam-filtering',
    routeName: 'rspamd-rules',
    title: legacy('admin.rspamd_settings_map'),
    description: 'systemSettings.rules.description',
    auditTarget: 'rspamdSettingsRule',
    visible: () => true,
  },
  {
    id: 'filter-maps',
    group: 'spam-filtering',
    routeName: 'system-settings-filter-maps',
    title: legacy('admin.rspamd_global_filters'),
    description: 'systemSettings.filterMaps.description',
    auditTarget: 'rspamdRegexMap',
    visible: () => true,
  },
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
