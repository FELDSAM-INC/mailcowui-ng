// The routes of UI 006's quarantine area (data-model §5 as the legacy form map changes it). Every
// page is lazy-loaded together with the feature's strings (`loadFeatureMessages('quarantine')`),
// which the shell does not bundle. Pages narrower than the Quarantine entry carry `meta.roles`
// (UI 002 D4); pages of the section navigation carry `meta.sectionNav` (`QuarantineSectionNav`).
// Literal paths sit next to `/quarantine/:itemId(\d+)`, which matches digits only.
import type { RouteRecordRaw } from 'vue-router'

import { legacy, loadFeatureMessages } from '@/i18n'

/** A page and the 006 strings, loaded together. */
export function page<T>(load: () => Promise<T>): () => Promise<T> {
  return () => Promise.all([load(), loadFeatureMessages('quarantine')]).then(([module]) => module)
}

export const quarantineRoutes: RouteRecordRaw[] = [
  // US1, US2: the quarantine list of the caller's scope (the classic `quarantine.php`).
  {
    path: '/quarantine',
    name: 'quarantine',
    component: page(() => import('./pages/QuarantineListPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'quarantine',
      titleKey: legacy('quarantine.quarantine'),
      sectionNav: { labelKey: legacy('quarantine.quarantine'), order: 1 },
    },
  },
  // US3 (D10): the mailbox user's notifications, until UI 005's mail settings page hosts them.
  {
    path: '/quarantine/notifications',
    name: 'quarantine-notifications',
    component: page(() => import('./pages/NotificationsPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'quarantine',
      roles: ['mailboxUser'],
      titleKey: legacy('user.quarantine_notification'),
      sectionNav: { labelKey: legacy('user.quarantine_notification'), order: 2 },
    },
  },
  // US7: the quarantine settings (System › Configuration › Quarantine in the classic interface).
  {
    path: '/quarantine/settings',
    name: 'quarantine-settings',
    component: page(() => import('./pages/QuarantineSettingsPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'quarantine',
      roles: ['admin'],
      titleKey: legacy('admin.quarantine'),
      sectionNav: { labelKey: legacy('header.mailcow_config'), order: 4 },
    },
  },
  // US8: the spam filter's action statistics (the classic dashboard's Rspamd chart).
  {
    path: '/quarantine/statistics',
    name: 'quarantine-statistics',
    component: page(() => import('./pages/SpamFilterStatisticsPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'quarantine',
      roles: ['admin'],
      titleKey: legacy('mailbox.stats'),
      sectionNav: { labelKey: legacy('mailbox.stats'), order: 5 },
    },
  },
  // US1, US2: one item (the classic item modal), after the literal paths; digits only.
  {
    path: '/quarantine/:itemId(\\d+)',
    name: 'quarantine-item',
    component: page(() => import('./pages/QuarantineItemPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'quarantine',
      titleKey: legacy('quarantine.qitem'),
    },
  },
]
