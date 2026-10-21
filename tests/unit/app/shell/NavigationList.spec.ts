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

async function mountList(role: Identity['role'], path = '/operations/logs') {
  const router = createTestRouter()
  await router.push(path)
  await router.isReady()
  const wrapper = mountWithApp(NavigationList, {
    props: { identity: identity(role) },
    global: { plugins: [router] },
  })
  await flushPromises()
  return wrapper
}

describe('NavigationList groups', () => {
  it('groups content tabs behind one sidebar entry and highlights the active section', async () => {
    const wrapper = await mountList('admin')
    const group = wrapper.get('[data-nav-group="system"]')
    const heading = group.get('h2')
    expect(heading.text()).toBe('System')
    const list = group.get('ul')
    expect(list.attributes('aria-labelledby')).toBe(heading.attributes('id'))
    expect(list.findAll('a').map((link) => [link.text(), link.attributes('href')])).toEqual([
      ['System & Containers', '/ng/operations/dashboard'],
      ['Queue Manager', '/ng/operations/mail-queue'],
    ])
    expect(list.get('a[aria-current="page"]').text()).toBe('System & Containers')
    expect(wrapper.find('a[href="/ng/"]').exists()).toBe(false)
    expect(wrapper.find('a[href="/ng/passkeys"]').exists()).toBe(false)
    expect(wrapper.find('a[href="/ng/account"]').exists()).toBe(false)
    expect(wrapper.find('a[href="/ng/dns/mta-sts-policies"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('highlights the separate Queue Manager entry for a message deep link', async () => {
    const wrapper = await mountList('admin', '/operations/mail-queue/messages/4ABCD123')
    const group = wrapper.get('[data-nav-group="system"]')
    expect(group.get('a[aria-current="page"]').text()).toBe('Queue Manager')
    wrapper.unmount()
  })

  it('shows no System group to domain administrators', async () => {
    const wrapper = await mountList('domainAdmin')
    expect(wrapper.find('[data-nav-group="system"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Queue Manager')
    wrapper.unmount()
  })

  it('supports collapsing sections and links to System mails', async () => {
    const wrapper = await mountList('admin')
    const section = wrapper.get('[data-nav-group="email"]')
    const trigger = section.get('button')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    const mails = wrapper.get('[data-nav-item="systemMails"]')
    expect(mails.attributes('aria-disabled')).toBeUndefined()
    expect(mails.attributes('href')).toBe('/ng/system/mass-mail/send')
    wrapper.unmount()
  })
})
