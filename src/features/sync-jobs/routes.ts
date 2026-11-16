// The routes of UI 008 (data-model §5). Every component is lazy-loaded (research R22), together with
// the feature's own strings (`loadFeatureMessages`), which the shell does not bundle.
import type { RouteRecordRaw } from 'vue-router'

import { legacy, loadFeatureMessages } from '@/i18n'

/** A page and the sync job strings, loaded together. */
function page<T>(load: () => Promise<T>): () => Promise<T> {
  return () => Promise.all([load(), loadFeatureMessages('sync-jobs')]).then(([module]) => module)
}

export const syncJobRoutes: RouteRecordRaw[] = [
  {
    path: '/sync-sources',
    name: 'sync-sources',
    component: page(() => import('./sources/SourcesPage.vue')),
    meta: { layout: 'shell', access: 'session', navEntry: 'syncJobs', titleKey: 'nav.syncSources' },
  },
  {
    path: '/sync-sources/new',
    name: 'sync-source-create',
    component: page(() => import('./sources/SourceEditorPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'syncJobs',
      titleKey: 'syncSources.create',
    },
  },
  {
    path: '/sync-sources/oauth/return',
    name: 'sync-source-oauth-return',
    component: page(() => import('./sources/OAuthReturnPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'syncJobs',
      titleKey: 'syncSources.connections',
    },
  },
  {
    path: '/sync-sources/:sourceId([1-9][0-9]{0,9})',
    name: 'sync-source-detail',
    component: page(() => import('./sources/SourceEditorPage.vue')),
    meta: { layout: 'shell', access: 'session', navEntry: 'syncJobs', titleKey: 'nav.syncSources' },
  },
  {
    path: '/sync-queue',
    name: 'sync-queue',
    component: page(() => import('./pages/SyncQueuePage.vue')),
    meta: { layout: 'shell', access: 'session', navEntry: 'syncJobs', titleKey: 'nav.syncQueue' },
  },
  {
    path: '/sync-jobs',
    name: 'sync-jobs',
    component: page(() => import('./pages/SyncJobsPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'syncJobs',
      titleKey: legacy('mailbox.sync_jobs'),
    },
  },
  {
    // `?mailbox=<address>` preselects the owner for administrators and domain administrators.
    path: '/sync-jobs/new',
    name: 'sync-job-create',
    component: page(() => import('./pages/SyncJobCreatePage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'syncJobs',
      titleKey: legacy('add.syncjob'),
    },
  },
  {
    // The classic `/edit/syncjob/{id}` maps here (UI 014). Identifiers above the contract's
    // maximum render "not found" in place without a request.
    path: '/sync-jobs/:syncJobId([1-9][0-9]{0,9})',
    name: 'sync-job-detail',
    component: page(() => import('./pages/SyncJobDetailPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'syncJobs',
      titleKey: legacy('edit.syncjob'),
    },
  },
]
