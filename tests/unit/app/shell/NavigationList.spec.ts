// UI 011 (FR-001, research R3, T023): consecutive entries of one group are listed under the group's
// heading, as a list labelled by it; the System group is legacy's `header.mailcow_system`.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { Identity } from '@/api'
import NavigationList from '@/app/shell/NavigationList.vue'

import { mountWithApp } from '../../support/mount'
import { createTestRouter } from '../../support/router'

function identity(role: Identity['role']): Identity {
  return {
    username: role === 'admin' ? 'admin' : 'reseller',
    role,
    authentication: { method: 'password' },
    scope:
      role === 'admin' ? { type: 'allDomains' } : { type: 'domains', domains: ['example.org'] },
    permissions: Object.fromEntries(
      ['spamAlias', 'syncjobs', 'bccMaps', 'spamScore', 'spamPolicy'].map((flag) => [
        flag,
        role === 'admin',
      ]),
    ) as unknown as Identity['permissions'],
    pendingActions: [],
  }
}

async function mountList(role: Identity['role']) {
  const router = createTestRouter()
  await router.push('/operations/logs')
  await router.isReady()
  const wrapper = mountWithApp(NavigationList, {
    props: { identity: identity(role) },
    global: { plugins: [router] },
  })
  await flushPromises()
  return wrapper
}

describe('NavigationList groups', () => {
  it('lists the System entries under their heading for administrators', async () => {
    const wrapper = await mountList('admin')
    const group = wrapper.get('[data-nav-group]')
    const heading = group.get('h2')
    expect(heading.text()).toBe('System')
    const list = group.get('ul')
    expect(list.attributes('aria-labelledby')).toBe(heading.attributes('id'))
    expect(list.findAll('a').map((link) => [link.text(), link.attributes('href')])).toEqual([
      ['System & Containers', '/ng/operations/dashboard'],
      ['Logs', '/ng/operations/logs'],
      ['Queue Manager', '/ng/operations/mail-queue'],
      ['Fail2ban parameters', '/ng/operations/fail2ban'],
    ])
    expect(list.get('a[aria-current="page"]').text()).toBe('Logs')
  })

  it('shows no System group to domain administrators', async () => {
    const wrapper = await mountList('domainAdmin')
    expect(wrapper.find('[data-nav-group]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Queue Manager')
  })
})
