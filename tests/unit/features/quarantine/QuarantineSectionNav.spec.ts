// UI 006 (T024, research R6): the section navigation lists the registered routes of the Quarantine
// entry with `meta.sectionNav`, in order, for the roles allowed, and marks the current one.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'

import { queryKeys, type Identity } from '@/api'
import QuarantineSectionNav from '@/features/quarantine/components/QuarantineSectionNav.vue'
import { legacy } from '@/i18n'

import { mountWithApp, testPlugins } from '../../support/mount'

const blank = { render: () => null }
const routes: RouteRecordRaw[] = [
  {
    path: '/quarantine',
    name: 'quarantine',
    component: blank,
    meta: {
      navEntry: 'quarantine',
      sectionNav: { labelKey: legacy('quarantine.quarantine'), order: 1 },
    },
  },
  {
    path: '/quarantine/statistics',
    name: 'quarantine-statistics',
    component: blank,
    meta: {
      navEntry: 'quarantine',
      roles: ['admin'],
      sectionNav: { labelKey: legacy('mailbox.stats'), order: 5 },
    },
  },
  {
    path: '/quarantine/notifications',
    name: 'quarantine-notifications',
    component: blank,
    meta: {
      navEntry: 'quarantine',
      roles: ['mailboxUser'],
      sectionNav: { labelKey: legacy('user.quarantine_notification'), order: 2 },
    },
  },
  {
    path: '/quarantine/settings',
    name: 'quarantine-settings',
    component: blank,
    meta: {
      navEntry: 'quarantine',
      roles: ['admin'],
      sectionNav: { labelKey: legacy('header.mailcow_config'), order: 4 },
    },
  },
  {
    path: '/quarantine/:itemId(\\d+)',
    name: 'quarantine-item',
    component: blank,
    meta: { navEntry: 'quarantine' },
  },
  {
    path: '/domains',
    name: 'domains',
    component: blank,
    meta: { navEntry: 'domains', sectionNav: { labelKey: 'x', order: 0 } },
  },
]

async function mountAs(role: Identity['role'], path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  await router.isReady()
  testPlugins().queryClient.setQueryData(queryKeys.identity(), {
    role,
    username: 'u',
    permissions: {},
  })
  const wrapper = mountWithApp(QuarantineSectionNav, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('QuarantineSectionNav', () => {
  it('lists the administrator entries in order and marks the current page', async () => {
    const wrapper = await mountAs('admin', '/quarantine/settings')
    const links = wrapper.findAll('a')
    expect(links.map((link) => link.text())).toEqual(['Quarantine', 'Configuration', 'Statistics'])
    expect(links[1]!.attributes('aria-current')).toBe('page')
    expect(links[0]!.attributes('aria-current')).toBeUndefined()
    expect(wrapper.get('nav').attributes('aria-label')).toBe('Quarantine sections')
  })

  it('shows mailbox users only their entries', async () => {
    const wrapper = await mountAs('mailboxUser', '/quarantine')
    expect(wrapper.findAll('a').map((link) => link.text())).toEqual([
      'Quarantine',
      'Quarantine notifications',
    ])
  })

  it('shows nothing with a single entry', async () => {
    const wrapper = await mountAs('domainAdmin', '/quarantine')
    expect(wrapper.find('nav').exists()).toBe(false)
  })
})
