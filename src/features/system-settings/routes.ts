import type { RouteRecordRaw } from 'vue-router'
import { legacy, loadFeatureMessages } from '@/i18n'

export const systemSettingsRoutes: RouteRecordRaw[] = [
  {
    path: '/system',
    component: () =>
      Promise.all([
        import('./layouts/SettingsLayout.vue'),
        loadFeatureMessages('system-settings'),
      ]).then(([page]) => page),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'system',
      roles: ['admin'],
      titleKey: 'nav.system',
    },
    children: [
      {
        path: 'cors',
        name: 'system-settings-cors',
        component: () => import('./pages/integrations/CorsPage.vue'),
        meta: { titleKey: legacy('admin.cors_settings') },
      },
      {
        path: 'license',
        name: 'system-settings-license',
        component: () => import('./pages/integrations/LicensePage.vue'),
        meta: { titleKey: legacy('admin.guid_and_license') },
      },
      {
        path: 'global-sieve-filters',
        name: 'system-settings-global-sieve',
        component: () => import('./pages/mail-filtering/GlobalSieveFiltersPage.vue'),
        meta: { titleKey: 'systemSettings.globalSieve.title' },
      },
      {
        path: 'rspamd-rules',
        name: 'rspamd-rules',
        component: () => import('./pages/spam/RspamdRulesPage.vue'),
        meta: { titleKey: legacy('admin.rspamd_settings_map') },
      },
      {
        path: 'rspamd-rules/-/new',
        name: 'rspamd-rule-create',
        component: () => import('./pages/spam/RspamdRuleCreatePage.vue'),
        meta: { titleKey: legacy('admin.add_settings_rule') },
      },
      {
        path: 'rspamd-rules/:ruleId',
        name: 'rspamd-rule-detail',
        component: () => import('./pages/spam/RspamdRuleDetailPage.vue'),
        meta: { titleKey: legacy('admin.rspamd_settings_map') },
      },
      {
        path: 'rspamd-effective-map',
        name: 'rspamd-effective-map',
        component: () => import('./pages/spam/EffectiveSettingsMapPage.vue'),
        meta: { titleKey: legacy('admin.active_rspamd_settings_map') },
      },
      {
        path: 'customize',
        component: () => import('./layouts/CustomizeLayout.vue'),
        children: [
          {
            path: 'colours',
            name: 'system-settings-colours',
            component: () => import('./pages/branding/ColoursPage.vue'),
            meta: { titleKey: 'systemSettings.colours.title' },
          },
          { path: '', redirect: { name: 'system-settings-logos' } },
          {
            path: 'login-page',
            name: 'system-settings-sign-in-page',
            component: () => import('./pages/branding/SignInPageSettingsPage.vue'),
            meta: { titleKey: legacy('admin.login_page') },
          },
          {
            path: 'app-links',
            name: 'system-settings-app-links',
            component: () => import('./pages/branding/AppLinksPage.vue'),
            meta: { titleKey: legacy('admin.app_links') },
          },
          {
            path: 'logos',
            name: 'system-settings-logos',
            component: () => import('./pages/branding/LogosPage.vue'),
            meta: { titleKey: legacy('admin.change_logo') },
          },
          {
            path: 'ui-texts',
            name: 'system-settings-ui-texts',
            component: () => import('./pages/branding/UiTextsPage.vue'),
            meta: { titleKey: legacy('admin.ui_texts') },
          },
        ],
      },
      {
        path: 'mass-mail/send',
        name: 'system-settings-mass-mail-send',
        component: () => import('./pages/mass-mail/MassMailSendPage.vue'),
        meta: { titleKey: legacy('admin.sys_mails') },
      },
      {
        path: 'mass-mail/jobs',
        name: 'system-settings-mass-mail-jobs',
        component: () => import('./pages/mass-mail/MassMailJobsPage.vue'),
        meta: { titleKey: 'systemSettings.massMail.jobs' },
      },
      {
        path: 'mass-mail/jobs/:jobId([0-9A-HJKMNP-TV-Z]{26})',
        name: 'system-settings-mass-mail-job',
        component: () => import('./pages/mass-mail/MassMailJobPage.vue'),
        meta: { titleKey: 'systemSettings.massMail.jobs' },
      },
      {
        path: 'rspamd-web-interface',
        name: 'system-settings-rspamd-web-interface',
        component: () => import('./pages/spam/RspamdWebInterfacePage.vue'),
        meta: { titleKey: 'nav.rspamdUi' },
      },
      {
        path: 'filter-maps',
        name: 'system-settings-filter-maps',
        component: () => import('./pages/spam/FilterMapsPage.vue'),
        meta: { titleKey: legacy('admin.rspamd_global_filters') },
      },
      {
        path: 'filter-maps/:mapId',
        name: 'system-settings-filter-map',
        component: () => import('./pages/spam/FilterMapPage.vue'),
        meta: { titleKey: legacy('admin.regex_maps') },
      },
      {
        path: '',
        name: 'system-settings',
        redirect: '/dns/dkim-keys',
      },
      {
        path: 'quota-notifications',
        name: 'system-settings-quota-notifications',
        component: () => import('./pages/notifications/QuotaNotificationsPage.vue'),
        meta: { titleKey: legacy('admin.quota_notifications') },
      },
      {
        path: 'password-policy',
        name: 'system-settings-password-policy',
        component: () => import('./pages/passwords/PasswordPolicyPage.vue'),
        meta: { titleKey: legacy('admin.password_settings') },
      },
      {
        path: 'password-reset-email',
        name: 'system-settings-password-reset-email',
        redirect: { name: 'system-settings-password-policy', hash: '#password-reset-email' },
      },
      {
        path: 'ip-check',
        name: 'system-settings-ip-check',
        component: () => import('./pages/integrations/IpCheckPage.vue'),
        meta: { titleKey: legacy('admin.ip_check') },
      },
    ],
  },
]
