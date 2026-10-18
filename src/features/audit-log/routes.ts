// The audit log route (data-model §5), administrators only through the catalogue entry.
import type { RouteRecordRaw } from 'vue-router'

export const auditLogRoutes: RouteRecordRaw[] = [
  {
    path: '/audit-log',
    name: 'audit-log',
    component: () => import('./pages/AuditLogPage.vue'),
    meta: { layout: 'shell', access: 'session', navEntry: 'auditLog', titleKey: 'auditLog.title' },
  },
]
