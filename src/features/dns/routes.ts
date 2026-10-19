// The routes of UI 010 (data-model §5, research R2). Every page is lazy-loaded together with the
// feature's own strings (`loadFeatureMessages`), which the shell does not bundle. Administrator-only
// pages carry `meta.roles` (UI 002 D4).
import type { RouteRecordRaw } from 'vue-router'

import { legacy, loadFeatureMessages } from '@/i18n'

/** A page and the DNS strings, loaded together. */
function page<T>(load: () => Promise<T>): () => Promise<T> {
  return () => Promise.all([load(), loadFeatureMessages('dns')]).then(([module]) => module)
}

export const dnsRoutes: RouteRecordRaw[] = [
  { path: '/dns', name: 'dns', redirect: { name: 'dkim-keys' } },
  {
    path: '/dns/dkim-keys',
    name: 'dkim-keys',
    component: page(() => import('./pages/DkimKeysPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'dkimKeys',
      titleKey: legacy('admin.dkim_keys'),
    },
  },
  {
    path: '/dns/dkim-import',
    name: 'dkim-import',
    component: page(() => import('./pages/DkimImportPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'dkimKeys',
      roles: ['admin'],
      titleKey: legacy('admin.import_private_key'),
    },
  },
  {
    path: '/dns/dkim-keys/:dkimName/copy',
    name: 'dkim-copy',
    component: page(() => import('./pages/DkimCopyPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'dkimKeys',
      roles: ['admin'],
      titleKey: legacy('admin.duplicate_dkim'),
    },
  },
  {
    path: '/dns/dkim-keys/:dkimName',
    name: 'dkim-key',
    component: page(() => import('./pages/DkimKeyPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'dkimKeys',
      titleKey: legacy('admin.dkim_keys'),
    },
  },
  {
    path: '/dns/diagnostics/:diagnosticsName',
    name: 'dns-diagnostics',
    component: page(() => import('./pages/DnsDiagnosticsPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'dkimKeys',
      titleKey: legacy('diagnostics.dns_records'),
    },
  },
  {
    path: '/dns/mta-sts-policies',
    name: 'mta-sts-policies',
    component: page(() => import('./pages/MtaStsPoliciesPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'mtaStsPolicies',
      titleKey: legacy('edit.mta_sts'),
    },
  },
]
