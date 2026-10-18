// The routes of UI 008 (data-model §5). Every component is lazy-loaded (research R22).
import type { RouteRecordRaw } from 'vue-router'

import { legacy } from '@/i18n'

export const syncJobRoutes: RouteRecordRaw[] = [
  {
    path: '/sync-jobs',
    name: 'sync-jobs',
    component: () => import('./pages/SyncJobsPage.vue'),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'syncJobs',
      titleKey: legacy('mailbox.sync_jobs'),
    },
  },
  {
    // The classic `/edit/syncjob/{id}` maps here (UI 014). Identifiers above the contract's
    // maximum render "not found" in place without a request.
    path: '/sync-jobs/:syncJobId([1-9][0-9]{0,9})',
    name: 'sync-job-detail',
    component: () => import('./pages/SyncJobDetailPage.vue'),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'syncJobs',
      titleKey: legacy('edit.syncjob'),
    },
  },
]
