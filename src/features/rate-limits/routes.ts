// The routes of UI 006's rate limit area: the Rate limits overview under the Quarantine entry
// (`/quarantine/rate-limits`, data-model §5), for administrators and domain administrators, third
// in the Quarantine section navigation. The rate limit of a domain, alias domain or mailbox is a
// section of its own page (legacy form map D9), not a route. The page loads with the 006 strings
// through the quarantine area's `page()`.
import type { RouteRecordRaw } from 'vue-router'

import { quarantinePage } from '@/features/quarantine'

export const rateLimitRoutes: RouteRecordRaw[] = [
  {
    path: '/quarantine/rate-limits',
    name: 'quarantine-rate-limits',
    component: quarantinePage(() => import('./pages/RateLimitsPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'quarantine',
      roles: ['admin', 'domainAdmin'],
      titleKey: 'rateLimits.title',
      sectionNav: { labelKey: 'rateLimits.title', order: 3 },
    },
  },
]
