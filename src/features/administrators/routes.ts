import type { RouteRecordRaw } from 'vue-router'
import { legacy, loadFeatureMessages } from '@/i18n'
function page<T>(load: () => Promise<T>): () => Promise<T> {
  return () =>
    Promise.all([load(), loadFeatureMessages('administrators')]).then(([module]) => module)
}
export const administratorRoutes: RouteRecordRaw[] = [
  {
    path: '/administrators/domain-admins',
    name: 'domain-admins',
    component: page(() => import('./pages/DomainAdminsPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'domainAdmins',
      roles: ['admin'],
      titleKey: legacy('admin.domain_admins'),
    },
  },
  {
    path: '/administrators/domain-admins/-/new',
    name: 'domain-admin-create',
    component: page(() => import('./pages/AccountCreatePage.vue')),
    props: { role: 'domainAdmin' },
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'domainAdmins',
      roles: ['admin'],
      titleKey: legacy('admin.add_domain_admin'),
    },
  },
  {
    path: '/administrators/domain-admins/:username',
    name: 'domain-admin-detail',
    component: page(() => import('./pages/AccountDetailPage.vue')),
    props: { role: 'domainAdmin' },
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'domainAdmins',
      roles: ['admin'],
      titleKey: legacy('edit.domain_admin'),
    },
  },
  {
    path: '/administrators/admins',
    name: 'admins',
    component: page(() => import('./pages/AdminsPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'administrators',
      roles: ['admin'],
      titleKey: legacy('admin.admin_details'),
    },
  },
  {
    path: '/administrators/admins/-/new',
    name: 'admin-create',
    component: page(() => import('./pages/AccountCreatePage.vue')),
    props: { role: 'admin' },
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'administrators',
      roles: ['admin'],
      titleKey: legacy('admin.add_admin'),
    },
  },
  {
    path: '/administrators/admins/:username',
    name: 'admin-detail',
    component: page(() => import('./pages/AccountDetailPage.vue')),
    props: { role: 'admin' },
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'administrators',
      roles: ['admin'],
      titleKey: legacy('edit.admin'),
    },
  },
]
