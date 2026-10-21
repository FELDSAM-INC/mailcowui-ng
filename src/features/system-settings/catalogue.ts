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
export interface SettingsSection {
  /** Existing section/heading id; omitted for destinations whose page heading is the target. */
  id?: string
  title: TextRef
  fields?: readonly TextRef[]
  routeName?: string
}
export interface SettingsPage {
  id: string
  group: (typeof settingsGroups)[number]
  routeName: string
  title: TextRef
  description: string
  legacyNames?: readonly TextRef[]
  fields?: readonly TextRef[]
  sections?: readonly SettingsSection[]
  auditTarget: AuditTargetType
  visible: (caps: SettingsCapabilities) => boolean
}
export const settingsPages: readonly SettingsPage[] = [
  {
    id: 'colours',
    legacyNames: [legacy('admin.customize')],
    sections: [
      {
        id: 'section-brand-colours',
        title: 'systemSettings.colours.settings',
        fields: ['systemSettings.colours.light', 'systemSettings.colours.dark'],
      },
      { id: 'colour-preview-title', title: 'systemSettings.colours.preview' },
    ],
    group: 'branding',
    routeName: 'system-settings-colours',
    title: 'systemSettings.colours.title',
    description: 'systemSettings.colours.description',
    auditTarget: 'brandColors',
    visible: () => true,
  },
  {
    id: 'cors',
    sections: [
      {
        id: 'section-cors',
        title: legacy('admin.cors_settings'),
        fields: [legacy('admin.allowed_origins'), legacy('admin.allowed_methods')],
      },
    ],
    group: 'integrations',
    routeName: 'system-settings-cors',
    title: legacy('admin.cors_settings'),
    description: 'systemSettings.cors.description',
    auditTarget: 'legacyApiCors',
    visible: () => true,
  },
  {
    id: 'license',
    sections: [{ id: 'license', title: legacy('admin.guid') }],
    group: 'integrations',
    routeName: 'system-settings-license',
    title: legacy('admin.guid_and_license'),
    description: 'systemSettings.license.description',
    auditTarget: 'license',
    visible: (caps) => caps.licenseVerificationEnabled,
  },
  {
    id: 'sign-in-page',
    legacyNames: [legacy('admin.customize')],
    sections: [
      {
        id: 'section-sign-in-links',
        title: legacy('admin.login_page'),
        fields: [
          legacy('admin.user_quicklink'),
          legacy('admin.domainadmin_quicklink'),
          legacy('admin.admin_quicklink'),
        ],
      },
      { id: 'section-single-sign-on', title: legacy('admin.force_sso') },
    ],
    group: 'branding',
    routeName: 'system-settings-sign-in-page',
    title: legacy('admin.login_page'),
    description: 'systemSettings.signInPage.description',
    auditTarget: 'loginPage',
    visible: () => true,
  },
  {
    id: 'app-links',
    legacyNames: [legacy('admin.customize')],
    sections: [
      {
        id: 'section-app-links',
        title: legacy('admin.app_links'),
        fields: [
          legacy('admin.app_name'),
          legacy('admin.link'),
          legacy('admin.user_link'),
          legacy('admin.app_hide'),
        ],
      },
      { id: 'built-in-links', title: 'systemSettings.appLinks.builtIn' },
    ],
    group: 'branding',
    routeName: 'system-settings-app-links',
    title: legacy('admin.app_links'),
    description: 'systemSettings.appLinks.description',
    auditTarget: 'appLinks',
    visible: () => true,
  },
  {
    id: 'global-sieve',
    legacyNames: [legacy('mailbox.filters')],
    sections: [
      { id: 'prefilter-title', title: 'systemSettings.globalSieve.prefilter' },
      { id: 'postfilter-title', title: 'systemSettings.globalSieve.postfilter' },
    ],
    group: 'mail-filtering',
    routeName: 'system-settings-global-sieve',
    title: 'systemSettings.globalSieve.title',
    description: 'systemSettings.globalSieve.description',
    auditTarget: 'globalSieveFilter',
    visible: () => true,
  },
  {
    id: 'logos',
    legacyNames: [legacy('admin.customize')],
    sections: [
      { id: 'logo-light-heading', title: legacy('admin.logo_normal_label') },
      { id: 'logo-dark-heading', title: legacy('admin.logo_dark_label') },
    ],
    group: 'branding',
    routeName: 'system-settings-logos',
    title: legacy('admin.change_logo'),
    description: 'systemSettings.logos.description',
    auditTarget: 'logo',
    visible: () => true,
  },
  {
    id: 'ui-texts',
    legacyNames: [legacy('admin.customize')],
    sections: [
      {
        id: 'section-names',
        title: 'systemSettings.uiTexts.names',
        fields: [legacy('admin.title_name'), legacy('admin.main_name'), legacy('admin.apps_name')],
      },
      { id: 'section-login-help', title: legacy('admin.help_text') },
      { id: 'section-footer', title: legacy('admin.ui_footer') },
      {
        id: 'section-announcement',
        title: legacy('admin.ui_header_announcement'),
        fields: [legacy('admin.text'), legacy('admin.ui_header_announcement_active')],
      },
    ],
    group: 'branding',
    routeName: 'system-settings-ui-texts',
    title: legacy('admin.ui_texts'),
    description: 'systemSettings.uiTexts.description',
    auditTarget: 'uiTexts',
    visible: () => true,
  },
  {
    id: 'mass-mail-send',
    fields: [
      legacy('admin.from'),
      legacy('admin.subject'),
      legacy('admin.text'),
      legacy('admin.html'),
      legacy('admin.include_exclude'),
      legacy('admin.recipients'),
      'systemSettings.massMail.scope',
      'systemSettings.massMail.domains',
      'systemSettings.massMail.paste',
    ],
    group: 'mass-mail',
    routeName: 'system-settings-mass-mail-send',
    title: legacy('admin.sys_mails'),
    description: 'systemSettings.massMail.description',
    auditTarget: 'massMailJob',
    visible: () => true,
  },
  {
    id: 'mass-mail-jobs',
    group: 'mass-mail',
    routeName: 'system-settings-mass-mail-jobs',
    title: 'systemSettings.massMail.jobs',
    description: 'systemSettings.massMail.description',
    auditTarget: 'massMailJob',
    visible: () => true,
    legacyNames: [legacy('admin.sys_mails')],
    fields: ['systemSettings.massMail.status', 'systemSettings.massMail.searchJobs'],
  },
  {
    id: 'quota-notifications',
    sections: [
      {
        id: 'section-notification-email',
        title: legacy('admin.quota_notifications'),
        fields: [
          legacy('admin.quota_notification_sender'),
          legacy('admin.quota_notification_subject'),
          legacy('admin.quarantine_notification_html'),
        ],
      },
      { id: 'copies', title: legacy('edit.quota_warning_bcc') },
    ],
    group: 'notifications',
    routeName: 'system-settings-quota-notifications',
    title: legacy('admin.quota_notifications'),
    description: 'systemSettings.quota.description',
    auditTarget: 'quotaNotification',
    visible: () => true,
  },
  {
    id: 'rspamd-rules',
    fields: [
      legacy('admin.rsetting_desc'),
      legacy('admin.active'),
      legacy('admin.rsetting_content'),
    ],
    sections: [
      { title: legacy('admin.active_rspamd_settings_map'), routeName: 'rspamd-effective-map' },
    ],
    group: 'spam-filtering',
    routeName: 'rspamd-rules',
    title: legacy('admin.rspamd_settings_map'),
    description: 'systemSettings.rules.description',
    auditTarget: 'rspamdSettingsRule',
    visible: () => true,
  },
  {
    id: 'filter-maps',
    legacyNames: [legacy('admin.regex_maps')],
    fields: ['systemSettings.filterMaps.format'],
    group: 'spam-filtering',
    routeName: 'system-settings-filter-maps',
    title: legacy('admin.rspamd_global_filters'),
    description: 'systemSettings.filterMaps.description',
    auditTarget: 'rspamdRegexMap',
    visible: () => true,
  },
  {
    id: 'password-policy',
    sections: [
      {
        id: 'section-policy',
        title: legacy('admin.password_policy'),
        fields: [
          legacy('admin.password_length'),
          legacy('admin.password_policy_chars'),
          legacy('admin.password_policy_special_chars'),
          legacy('admin.password_policy_lowerupper'),
          legacy('admin.password_policy_numbers'),
        ],
      },
      {
        id: 'password-reset-email',
        title: legacy('admin.password_reset_settings'),
        fields: [
          legacy('admin.quota_notification_sender'),
          legacy('admin.quota_notification_subject'),
          legacy('admin.password_reset_tmpl_html'),
          legacy('admin.password_reset_tmpl_text'),
        ],
      },
    ],
    group: 'passwords',
    routeName: 'system-settings-password-policy',
    title: legacy('admin.password_settings'),
    description: 'systemSettings.passwordPolicy.description',
    auditTarget: 'passwordPolicy',
    visible: () => true,
  },
  {
    id: 'rspamd-web-interface',
    fields: [legacy('admin.password'), legacy('admin.password_repeat')],
    group: 'spam-filtering',
    routeName: 'system-settings-rspamd-web-interface',
    title: 'nav.rspamdUi',
    description: 'systemSettings.rspamdUi.description',
    auditTarget: 'rspamdUiPassword',
    visible: () => true,
  },
  {
    id: 'ip-check',
    sections: [
      {
        id: 'section-opt-in',
        title: legacy('admin.ip_check'),
        fields: [legacy('admin.ip_check_opt_in')],
      },
    ],
    group: 'integrations',
    routeName: 'system-settings-ip-check',
    title: legacy('admin.ip_check'),
    description: 'systemSettings.ipCheck.description',
    auditTarget: 'ipCheck',
    visible: () => true,
  },
]
