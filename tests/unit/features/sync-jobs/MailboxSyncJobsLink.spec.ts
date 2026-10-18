// The entry point into UI 003's mailbox page (UI 008 T029, FR-004, research R4): a link to the
// list filtered to the mailbox, only when the identity may open sync jobs, and no request.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { queryKeys } from '@/api'
import { MailboxSyncJobsLink } from '@/features/sync-jobs'

import { permissionFlags } from '../../../mocks/scenarios/accounts'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'

const router = () =>
  createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [{ path: '/sync-jobs', name: 'sync-jobs', component: { render: () => null } }],
  })

function mountAs(role: 'admin' | 'domainAdmin', syncjobs: boolean) {
  useScenario('admin-active')
  testPlugins().queryClient.setQueryData(queryKeys.identity(), {
    username: role === 'admin' ? 'admin' : 'reseller',
    role,
    permissions: permissionFlags(role === 'admin', { syncjobs }),
    scope:
      role === 'admin' ? { type: 'allDomains' } : { type: 'domains', domains: ['example.org'] },
  })
  return mountWithApp(MailboxSyncJobsLink, {
    props: { address: 'alice@example.org' },
    global: { plugins: [router()] },
  })
}

describe('MailboxSyncJobsLink', () => {
  it('links to the list filtered to the mailbox for administrators', async () => {
    const before = mockState().requests.length
    const wrapper = mountAs('admin', true)
    await flushPromises()
    const link = wrapper.get('a')
    expect(link.text()).toBe('Sync jobs')
    expect(link.attributes('href')).toBe('/ng/sync-jobs?mailbox=alice@example.org')
    expect(mockState().requests.length).toBe(before)
  })

  it('is shown to domain administrators only with the flag', () => {
    expect(mountAs('domainAdmin', true).find('a').exists()).toBe(true)
    expect(mountAs('domainAdmin', false).find('a').exists()).toBe(false)
  })
})
