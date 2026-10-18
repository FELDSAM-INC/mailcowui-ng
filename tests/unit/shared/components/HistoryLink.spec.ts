// The History link (UI 002 T019, research D26): UI 001's audit log filtered to one object. Until
// the audit log route exists, the link is not shown (conventions "Where features meet").
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import HistoryLink from '@/shared/components/HistoryLink.vue'

import { mountWithApp } from '../../support/mount'

function router(withAuditLog = true) {
  return createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [
      { path: '/', component: { render: () => null } },
      ...(withAuditLog
        ? [{ path: '/audit-log', name: 'audit-log', component: { render: () => null } }]
        : []),
    ],
  })
}

describe('HistoryLink', () => {
  it('links to the audit log with targetType and targetId', async () => {
    const wrapper = mountWithApp(HistoryLink, {
      props: { targetType: 'domainTemplate', targetId: '7' },
      global: { plugins: [router()] },
    })
    await flushPromises()
    const link = wrapper.get('a')
    expect(link.attributes('href')).toBe('/ng/audit-log?targetType=domainTemplate&targetId=7')
    expect(link.text()).toBe('History')
  })

  it('UI 012: links to a target type alone, for an object without an ID', async () => {
    const wrapper = mountWithApp(HistoryLink, {
      props: { targetType: 'identityProvider' },
      global: { plugins: [router()] },
    })
    await flushPromises()
    expect(wrapper.get('a').attributes('href')).toBe('/ng/audit-log?targetType=identityProvider')
  })

  it('omits targetType when not given', async () => {
    const wrapper = mountWithApp(HistoryLink, {
      props: { targetId: 'example.org' },
      global: { plugins: [router()] },
    })
    await flushPromises()
    expect(wrapper.get('a').attributes('href')).toBe('/ng/audit-log?targetId=example.org')
  })

  it('renders nothing while the audit log route does not exist', async () => {
    const wrapper = mountWithApp(HistoryLink, {
      props: { targetId: 'example.org' },
      global: { plugins: [router(false)] },
    })
    await flushPromises()
    expect(wrapper.find('a').exists()).toBe(false)
  })
})
