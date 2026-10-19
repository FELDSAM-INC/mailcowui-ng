// The routes of UI 006's spam filter area: the mailbox user's Spam filter page (`/spam-filter`,
// catalogue entry `spamFilter`, offered with `spamScore` or `spamPolicy`), loaded with the 006
// strings. The spam filter of domains, alias domains and mailboxes is a section of their own pages
// (legacy form map D9), not a route.
import type { RouteRecordRaw } from 'vue-router'

import { quarantinePage } from '@/features/quarantine'
import { legacy } from '@/i18n'

export const spamFilterRoutes: RouteRecordRaw[] = [
  {
    path: '/spam-filter',
    name: 'spam-filter',
    component: quarantinePage(() => import('./pages/SpamFilterPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'spamFilter',
      titleKey: legacy('user.spamfilter'),
    },
  },
]
