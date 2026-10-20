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
        path: 'rspamd-web-interface',
        name: 'system-settings-rspamd-web-interface',
        component: () => import('./pages/spam/RspamdWebInterfacePage.vue'),
        meta: { titleKey: 'nav.rspamdUi' },
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
