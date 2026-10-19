// The routes of the domain alias screens (data-model §5). Every component is lazy-loaded (research
// R22), together with UI 004's strings (`loadFeatureMessages`), which the shell does not bundle. The
// add form lives at `/alias-domains/-/new`, as "new" is a valid domain label.
import type { RouteRecordRaw } from 'vue-router'

import { legacy, loadFeatureMessages } from '@/i18n'

function page<T>(load: () => Promise<T>): () => Promise<T> {
  return () => Promise.all([load(), loadFeatureMessages('aliases')]).then(([module]) => module)
}

export const aliasDomainRoutes: RouteRecordRaw[] = [
  {
    path: '/alias-domains',
    name: 'alias-domains',
    component: page(() => import('./pages/AliasDomainsPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'aliasDomains',
      titleKey: legacy('mailbox.domain_aliases'),
    },
  },
  {
    path: '/alias-domains/-/new',
    name: 'alias-domain-create',
    component: page(() => import('./pages/AliasDomainCreatePage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'aliasDomains',
      titleKey: legacy('mailbox.add_domain_alias'),
    },
  },
  {
    path: '/alias-domains/:aliasDomain',
    name: 'alias-domain-detail',
    component: page(() => import('./pages/AliasDomainDetailPage.vue')),
    meta: {
      layout: 'shell',
      access: 'session',
      navEntry: 'aliasDomains',
      titleKey: legacy('edit.edit_alias_domain'),
    },
  },
]
