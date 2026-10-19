// The routes of UI 011 (data-model §5, plan "Decisions at implementation" items 5 and 14). Every
// page is lazy-loaded together with the operations strings it needs (`loadFeatureMessages`), and
// every route is for administrators only through the catalogue entry it belongs to.
import type { RouteRecordRaw } from 'vue-router'

import { legacy, loadFeatureMessages, type MessageFeature } from '@/i18n'

/** `components.parameters.ContainerName` pattern of the contract. */
export const CONTAINER_NAME = /^[a-z0-9][a-z0-9_.-]{0,62}$/

/** A page and its strings, loaded together. */
function page<T>(load: () => Promise<T>, ...features: MessageFeature[]): () => Promise<T> {
  return () =>
    Promise.all([
      load(),
      loadFeatureMessages('operations'),
      ...features.map((feature) => loadFeatureMessages(feature)),
    ]).then(([module]) => module)
}

const DashboardPage = page(() => import('./dashboard/pages/DashboardPage.vue'))
const LogPage = page(() => import('./logs/pages/LogPage.vue'), 'operationsLogs')
const RspamdPage = page(() => import('./rspamd/pages/RspamdPage.vue'), 'operationsLogs')
const MailQueuePage = page(() => import('./mail-queue/pages/MailQueuePage.vue'), 'operationsQueue')
const Fail2banPage = page(() => import('./fail2ban/pages/Fail2banPage.vue'), 'operationsFail2ban')

const shell = { layout: 'shell', access: 'session' } as const

export const operationsRoutes: RouteRecordRaw[] = [
  { path: '/operations', name: 'operations', redirect: { name: 'operations-dashboard' } },
  {
    path: '/operations/dashboard',
    name: 'operations-dashboard',
    component: DashboardPage,
    meta: { ...shell, navEntry: 'dashboard', titleKey: legacy('debug.system_containers') },
  },
  {
    // FR-002: a container's own address opens the dashboard with its card expanded.
    path: `/operations/containers/:containerName(${CONTAINER_NAME.source.slice(1, -1)})`,
    name: 'operations-container',
    component: DashboardPage,
    props: (route) => ({ expand: route.params.containerName }),
    meta: { ...shell, navEntry: 'dashboard', titleKey: legacy('debug.system_containers') },
  },
  {
    // Legacy has no log index: the Logs entry opens the first log (decision 5).
    path: '/operations/logs',
    name: 'operations-logs',
    redirect: { name: 'operations-log', params: { logType: 'postfix' } },
  },
  {
    path: '/operations/logs/rspamd',
    name: 'operations-rspamd',
    component: RspamdPage,
    meta: { ...shell, navEntry: 'logs', titleKey: legacy('debug.logs') },
  },
  {
    path: '/operations/logs/:logType',
    name: 'operations-log',
    component: LogPage,
    props: true,
    meta: { ...shell, navEntry: 'logs', titleKey: legacy('debug.logs') },
  },
  {
    path: '/operations/mail-queue',
    name: 'operations-mail-queue',
    component: MailQueuePage,
    meta: { ...shell, navEntry: 'mailQueue', titleKey: legacy('queue.queue_manager') },
  },
  {
    path: '/operations/mail-queue/messages/:queueId([0-9A-Fa-f]{1,32})',
    name: 'operations-mail-queue-message',
    component: MailQueuePage,
    props: true,
    meta: { ...shell, navEntry: 'mailQueue', titleKey: legacy('queue.queue_manager') },
  },
  {
    path: '/operations/fail2ban',
    name: 'operations-fail2ban',
    component: Fail2banPage,
    meta: { ...shell, navEntry: 'fail2ban', titleKey: legacy('admin.f2b_parameters') },
  },
]
