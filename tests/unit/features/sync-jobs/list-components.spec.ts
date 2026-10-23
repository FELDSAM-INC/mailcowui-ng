// The sync-job list and read-mode components (UI 008 T029): the card with its heading and the
// classic values per role, the table's headers with `aria-sort` and its details row, the filters
// per role with the phone sort, the stored values in the edit page's order, the result and state
// presentation, and the automatic refresh control.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import AutoRefreshControl from '@/features/sync-jobs/components/AutoRefreshControl.vue'
import SyncJobCard from '@/features/sync-jobs/components/SyncJobCard.vue'
import SyncJobFilters from '@/features/sync-jobs/components/SyncJobFilters.vue'
import SyncJobList from '@/features/sync-jobs/components/SyncJobList.vue'
import SyncJobResult from '@/features/sync-jobs/components/SyncJobResult.vue'
import SyncJobRunStatus from '@/features/sync-jobs/components/SyncJobRunStatus.vue'
import SyncJobStateBadges from '@/features/sync-jobs/components/SyncJobStateBadges.vue'
import SyncJobTable from '@/features/sync-jobs/components/SyncJobTable.vue'
import SyncJobValues from '@/features/sync-jobs/components/SyncJobValues.vue'

import { finishedRun, mockSyncJob, syncJobView } from '../../../mocks/factories/sync-job'
import { installMatchMedia } from '../../support/media'
import { mountWithApp } from '../../support/mount'

const router = () =>
  createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [
      { path: '/sync-jobs', name: 'sync-jobs', component: { render: () => null } },
      { path: '/sync-jobs/:syncJobId', name: 'sync-job-detail', component: { render: () => null } },
    ],
  })
const withRouter = () => ({ global: { plugins: [router()] } })

const job = syncJobView(
  mockSyncJob({
    id: 2,
    mailbox: 'alice@example.org',
    remoteHost: 'mail.previous.example',
    remoteUser: 'alice',
    runStatus: finishedRun('failed', 'EXIT_WEIRD'),
  }),
)
const filters = {
  q: undefined,
  mailbox: undefined,
  domain: undefined,
  active: undefined,
  running: undefined,
  result: undefined,
}

describe('SyncJobCard', () => {
  it('has the label as heading and the owner for managers', async () => {
    const wrapper = mountWithApp(SyncJobCard, { props: { job, role: 'admin' }, ...withRouter() })
    await flushPromises()
    expect(wrapper.get('h3').text()).toBe('alice@mail.previous.example:993')
    expect(wrapper.text()).toContain('Owner')
    expect(wrapper.text()).toContain('alice@example.org')
    expect(wrapper.text()).toContain('Check log')
    expect(wrapper.find('[data-result] button').exists()).toBe(false)
  })

  it('shows the remote username and encryption instead of the owner to mailbox users', async () => {
    const wrapper = mountWithApp(SyncJobCard, {
      props: { job, role: 'mailboxUser' },
      ...withRouter(),
    })
    expect(wrapper.text()).not.toContain('Owner')
    expect(wrapper.text()).toContain('Username')
    expect(wrapper.text()).not.toContain('SSL')
    await wrapper.get('[data-card-expand]').trigger('click')
    expect(wrapper.text()).toContain('SSL')
    expect(wrapper.text()).toContain('Interval (min)')
  })
})

describe('SyncJobTable', () => {
  it('has the classic headers with aria-sort and emits sorts', async () => {
    const wrapper = mountWithApp(SyncJobTable, {
      props: { jobs: [job], role: 'admin', sort: 'id', order: 'desc' },
      ...withRouter(),
    })
    const headers = wrapper.findAll('th').map((th) => th.text())
    expect(headers).toEqual([
      'ID ▼',
      'Owner',
      'Server',
      'Last run',
      'Last run result',
      'Active',
      'Status',
      'Action',
    ])
    expect(wrapper.findAll('th')[0]!.attributes('aria-sort')).toBe('descending')
    expect(wrapper.findAll('th')[2]!.attributes('aria-sort')).toBe('none')
    await wrapper.findAll('th')[2]!.get('button').trigger('click')
    expect(wrapper.emitted('sort')).toEqual([['remoteHost', 'asc']])
    await wrapper.findAll('th')[0]!.get('button').trigger('click')
    expect(wrapper.emitted('sort')![1]).toEqual(['id', 'asc'])
  })

  it('has no owner column for mailbox users and expands the collapsed values', async () => {
    const wrapper = mountWithApp(SyncJobTable, {
      props: { jobs: [job], role: 'mailboxUser', sort: 'lastRunAt', order: 'asc' },
      ...withRouter(),
    })
    expect(wrapper.text()).not.toContain('Owner')
    expect(wrapper.text()).toContain('Username')
    const toggle = wrapper.get('button[aria-expanded]')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    const details = wrapper.get('[data-entry-details]')
    expect(details.text()).toContain('Encryption')
    expect(details.text()).toContain('(?i)spam|(?i)junk')
    await toggle.trigger('click')
    expect(wrapper.find('[data-entry-details]').exists()).toBe(false)
  })
})

describe('SyncJobList', () => {
  it('renders cards below md and a table from md up', async () => {
    const media = installMatchMedia({ '(min-width: 768px)': false })
    const wrapper = mountWithApp(SyncJobList, {
      props: { jobs: [job], role: 'admin', sort: 'id', order: 'desc' },
      ...withRouter(),
    })
    expect(wrapper.find('ul[aria-label="Sync jobs"]').exists()).toBe(true)
    media.set('(min-width: 768px)', true)
    await flushPromises()
    expect(wrapper.find('table').exists()).toBe(true)
  })
})

describe('SyncJobFilters', () => {
  it('offers the filters with the classic labels and emits changes', async () => {
    const wrapper = mountWithApp(SyncJobFilters, {
      props: { role: 'admin', filters, activeCount: 0, sort: 'id', order: 'desc', showSort: true },
    })
    const toggle = wrapper.get('button[aria-expanded]')
    expect(toggle.text()).toBe('Filters')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    const labels = wrapper.findAll('label').map((label) => label.text())
    expect(labels).toEqual([
      'Sort by',
      'Order',
      'Owner',
      'Domain',
      'Active',
      'Status',
      'Last run result',
    ])
    await wrapper.get('#sync-job-filter-running').setValue('yes')
    expect(wrapper.emitted('update')).toEqual([[{ running: 'yes' }]])
    await wrapper.get('#sync-job-filter-result').setValue('none')
    expect(wrapper.emitted('update')![1]).toEqual([{ result: 'none' }])
    await wrapper.get('#sync-job-sort').setValue('lastRunAt')
    expect(wrapper.emitted('sort')).toEqual([['lastRunAt', 'desc']])
    await wrapper.get('#sync-job-order').setValue('asc')
    expect(wrapper.emitted('sort')![1]).toEqual(['id', 'asc'])
    const options = wrapper.findAll('#sync-job-filter-result option').map((o) => o.text())
    expect(options).toEqual(['Any', 'Success', 'Failed', 'No result'])
  })

  it('counts the active filters, clears them, and drops the owner sort for mailbox users', async () => {
    const wrapper = mountWithApp(SyncJobFilters, {
      props: {
        role: 'mailboxUser',
        filters: { ...filters, active: 'no' as const },
        activeCount: 1,
        sort: 'id',
        order: 'desc',
        showSort: true,
      },
    })
    expect(wrapper.get('button[aria-expanded]').text()).toBe('Filters (1)')
    expect(wrapper.find('#sync-job-sort option[value="mailbox"]').exists()).toBe(false)
    await wrapper.get('button[aria-expanded]').trigger('click')
    const clear = wrapper.findAll('button').find((button) => button.text() === 'Clear filters')!
    await clear.trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
    expect(
      mountWithApp(SyncJobFilters, {
        props: {
          role: 'admin',
          filters,
          activeCount: 0,
          sort: 'id',
          order: 'desc',
          showSort: false,
        },
      })
        .find('#sync-job-sort')
        .exists(),
    ).toBe(false)
  })
})

describe('result and state', () => {
  it('reads a success with a check and its hidden prefix, and no result as "-"', () => {
    const success = mountWithApp(SyncJobResult, {
      props: { run: finishedRun('succeeded', 'EX_OK'), role: 'admin' },
    })
    expect(success.text()).toBe('Succeeded: Success')
    expect(success.find('svg').exists()).toBe(true)
    const none = mountWithApp(SyncJobResult, {
      props: { run: { ...finishedRun('succeeded', null), lastResult: 'unknown' }, role: 'admin' },
    })
    expect(none.text()).toBe('-')
    const plain = mountWithApp(SyncJobResult, {
      props: { run: finishedRun('failed', null), role: 'admin' },
    })
    expect(plain.find('button').exists()).toBe(false)
    expect(plain.text()).toContain('Check log')
  })

  it('shows the active glyph and the running or waiting status', () => {
    const active = mountWithApp(SyncJobStateBadges, {
      props: { active: false, running: true, role: 'admin', show: 'active' },
    })
    expect(active.text()).toBe('✕')
    const status = mountWithApp(SyncJobStateBadges, {
      props: { active: false, running: true, role: 'mailboxUser' },
    })
    expect(status.text()).toBe('Running')
    const waiting = mountWithApp(SyncJobStateBadges, {
      props: { active: true, running: false, role: 'admin' },
    })
    expect(waiting.text()).toBe('Waiting')
  })

  it('lists the run status with the owner only for managers', () => {
    const admin = mountWithApp(SyncJobRunStatus, { props: { job, role: 'admin' } })
    expect(admin.text()).toContain('Owner')
    const user = mountWithApp(SyncJobRunStatus, { props: { job, role: 'mailboxUser' } })
    expect(user.text()).not.toContain('Owner')
    expect(user.text()).toContain('Last run result')
  })
})

describe('SyncJobValues', () => {
  it('shows every field in the edit page order, glyphs for booleans and no password', () => {
    const wrapper = mountWithApp(SyncJobValues, {
      props: { job: { ...job, destinationSubfolder: '', remotePasswordSet: false } },
    })
    const labels = wrapper.findAll('dt').map((dt) => dt.text())
    expect(labels[0]).toBe('Hostname')
    expect(labels[1]).toBe('Port')
    expect(labels[13]).toBe('Delete duplicates on destination (--delete2duplicates)')
    expect(labels.at(-1)).toBe('Active')
    expect(wrapper.text()).toContain('No password is saved.')
    expect(wrapper.text()).toContain('✓')
    expect(wrapper.text()).not.toContain('remote-secret')
    const values = wrapper.findAll('dd').map((dd) => dd.text())
    expect(values[6]).toBe('-')
    expect(values[1]).toBe('993')
  })
})

describe('AutoRefreshControl', () => {
  it('is hidden without a running job and offers pause and resume', async () => {
    expect(
      mountWithApp(AutoRefreshControl, {
        props: { visible: false, paused: false, inactive: false },
      }).html(),
    ).toBe('<!--v-if-->')
    const running = mountWithApp(AutoRefreshControl, {
      props: { visible: true, paused: false, inactive: false },
    })
    await running.get('button').trigger('click')
    expect(running.emitted('pause')).toHaveLength(1)
    const paused = mountWithApp(AutoRefreshControl, {
      props: { visible: true, paused: true, inactive: false },
    })
    expect(paused.get('button').text()).toBe('Resume automatic refresh')
    const inactive = mountWithApp(AutoRefreshControl, {
      props: { visible: true, paused: false, inactive: true },
    })
    expect(inactive.text()).toContain('because you have been inactive')
    await inactive.get('button').trigger('click')
    expect(inactive.emitted('resume')).toHaveLength(1)
  })
})
