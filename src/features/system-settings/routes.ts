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
        component: () => import('./pages/SettingsOverviewPage.vue'),
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
