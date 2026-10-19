// The small pieces around the sync job screens (UI 008): the creation outcome kept in memory for the
// new job's page, the classic field label with its imapsync option, the domain source of the list's
// domain filter, the routes that load the feature's strings with their pages, and the row menu with
// the classic Edit and Remove.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import FieldLabel from '@/features/sync-jobs/components/FieldLabel.vue'
import SyncJobRowActions from '@/features/sync-jobs/components/SyncJobRowActions.vue'
import { domainSource } from '@/features/sync-jobs/domain-source'
import { rememberOutcome, takeOutcome } from '@/features/sync-jobs/outcome'
import { syncJobRoutes } from '@/features/sync-jobs/routes'
import { legacy } from '@/i18n'

import { mockSyncJob, syncJobView } from '../../../mocks/factories/sync-job'
import { useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

describe('creation outcome', () => {
  it('is taken once, and only by the job it was left for', () => {
    rememberOutcome(7, 'Saved')
    expect(takeOutcome(8)).toBeNull()
    expect(takeOutcome(7)).toBe('Saved')
    expect(takeOutcome(7)).toBeNull()
  })
})

describe('FieldLabel', () => {
  it('shows the classic label followed by the imapsync option in code', () => {
    const wrapper = mountWithApp(FieldLabel, {
      props: { text: legacy('add.delete1'), option: '--delete1' },
    })
    expect(wrapper.get('code').text()).toBe('(--delete1)')
    expect(wrapper.text()).toContain('Delete from source when completed')
  })

  it('shows the label alone without an option', () => {
    const wrapper = mountWithApp(FieldLabel, { props: { text: legacy('add.exclude') } })
    expect(wrapper.find('code').exists()).toBe(false)
  })
})

describe('domainSource', () => {
  it('searches the domains of the scope on the server, by name', async () => {
    useScenario('sync-jobs-admin')
    const page = await domainSource.fetchPage({ q: 'example.org', offset: 0, limit: 25 })
    expect(page.items.map((item) => item.name)).toContain('example.org')
    expect(page.total).toBeGreaterThan(0)
    expect(domainSource.queryKey('x')).toEqual(domainSource.queryKey('x'))
  })
})

describe('syncJobRoutes', () => {
  it('loads each page together with the sync job strings', async () => {
    for (const route of syncJobRoutes) {
      const load = route.component as () => Promise<{ default: unknown }>
      const module = await load()
      expect(module.default).toBeTruthy()
    }
    expect(syncJobRoutes.map((route) => route.name)).toEqual([
      'sync-jobs',
      'sync-job-create',
      'sync-job-detail',
    ])
  })
})

describe('SyncJobRowActions', () => {
  it('names the menu after the job and offers Edit and, when allowed, Remove', async () => {
    const router = createRouter({
      history: createMemoryHistory('/ng/'),
      routes: [{ path: '/:any(.*)*', component: { render: () => null } }],
    })
    const job = syncJobView(mockSyncJob({ id: 4, mailbox: 'alice@example.org' }))
    const wrapper = mountWithApp(SyncJobRowActions, {
      props: { job, role: 'admin', canRemove: true },
      global: { plugins: [router] },
      attachTo: document.body,
    })
    const trigger = wrapper.get('button')
    expect(trigger.attributes('aria-label')).toMatch(/^Actions for /)
    await trigger.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const items = [...document.querySelectorAll('[role="menuitem"]')].map((item) =>
      item.textContent?.trim(),
    )
    expect(items).toEqual(['Edit', 'Remove'])
    wrapper.unmount()
  })
})
