import type { RouteRecordRaw } from 'vue-router'
import { legacy, loadFeatureMessages } from '@/i18n'
function page<T>(load: () => Promise<T>): () => Promise<T> {
  return () => Promise.all([load(), loadFeatureMessages('account')]).then(([module]) => module)
}
export const filterRoutes: RouteRecordRaw[] = [
  {
    path: '/filters',
    name: 'filters',
    component: page(() => import('./pages/FiltersPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'filters',
      titleKey: legacy('mailbox.filters'),
    },
  },
  {
    path: '/filters/new',
    name: 'filter-create',
    component: page(() => import('./pages/FilterFormPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'filters',
      titleKey: 'filters.form.title',
    },
  },
  {
    path: '/filters/:filterId(\\d+)',
    name: 'filter-detail',
    component: page(() => import('./pages/FilterFormPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'filters',
      titleKey: 'filters.form.title',
    },
  },
]
/** Account route registry uses these lazy exports without importing form/API code eagerly. */
export const filterPages = {
  mailbox: page(() => import('./pages/MailboxFiltersPage.vue')),
  form: page(() => import('./pages/FilterFormPage.vue')),
}
