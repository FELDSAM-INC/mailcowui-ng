// The job page with its section (UI 008 T051, research R11): the `edit` address parameter opens the
// one section of the classic edit page (an invalid value is removed), a save sends the patch of
// changed fields with the loaded version, an outdated save lists the changes with "Save again" and
// "Discard my changes", and the running note follows a save of a running job.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import SyncJobDetailPage from '@/features/sync-jobs/pages/SyncJobDetailPage.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'

import { applyOverrides } from '../../../mocks/scenarios'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

const mounted: { unmount(): void }[] = []
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})

async function open(path: string, scenario = 'sync-jobs-admin') {
  useScenario(scenario)
  const router = createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [
      { path: '/sync-jobs', name: 'sync-jobs', component: { render: () => null } },
      { path: '/sync-jobs/:syncJobId', name: 'sync-job-detail', component: SyncJobDetailPage },
      { path: '/audit-log', name: 'audit-log', component: { render: () => null } },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mountWithApp(
    { components: { ConfirmDialog }, template: '<div><RouterView /><ConfirmDialog /></div>' },
    { global: { plugins: [router] }, attachTo: document.body },
  )
  mounted.push(wrapper)
  await flushPromises()
  if (path.includes('edit=syncjob')) {
    await settle(() => expect(wrapper.find('#syncjob-remoteHost').exists()).toBe(true))
  }
  return { wrapper, router }
}

/** Waits for an asynchronous outcome; saves take a moment on a loaded machine. */
const settle = (check: () => void) => vi.waitFor(check, { timeout: 5000 })

const updates = () => mockState().requests.filter((r) => r.operationId === 'updateSyncJob')

describe('SyncJobDetailPage', () => {
  it('opens the section from the address and removes an unknown section', async () => {
    const { wrapper, router } = await open('/sync-jobs/2?edit=syncjob')
    expect(wrapper.find('#section-syncjob form').exists()).toBe(true)
    await router.push('/sync-jobs/2?edit=bogus')
    await flushPromises()
    expect(router.currentRoute.value.query.edit).toBeUndefined()
  })

  it('saves the changed fields with the loaded version and closes the section', async () => {
    const { wrapper, router } = await open('/sync-jobs/2?edit=syncjob')
    const etag = mockState().requests.find((r) => r.operationId === 'getSyncJob')
    expect(etag).toBeDefined()
    await wrapper.get('#syncjob-intervalMinutes').setValue('45')
    await wrapper.get('#section-syncjob form').trigger('submit')
    await settle(() => expect(router.currentRoute.value.query.edit).toBeUndefined())
    await flushPromises()
    expect(updates()).toHaveLength(1)
    expect(updates()[0]!.body).toEqual({ intervalMinutes: 45 })
    expect(updates()[0]!.headers['if-match']).toMatch(/^"sj/)
    expect(router.currentRoute.value.query.edit).toBeUndefined()
    expect(wrapper.text()).toContain('Changes to mailbox alice@example.org have been saved')
  })

  it('lists the changes after an outdated save and saves again or discards', async () => {
    const { wrapper } = await open('/sync-jobs/2?edit=syncjob')
    await wrapper.get('#syncjob-exclude').setValue('(?i)trash')
    applyOverrides(mockState(), { syncJobs: { changeElsewhere: { id: 2, intervalMinutes: 45 } } })
    await wrapper.get('#section-syncjob form').trigger('submit')
    await settle(() => expect(wrapper.find('[data-outdated]').exists()).toBe(true))
    expect(wrapper.get('[data-outdated]').text()).toContain('Interval (min): now saved as 45')
    expect((wrapper.get('#syncjob-exclude').element as HTMLInputElement).value).toBe('(?i)trash')
    const discard = wrapper.findAll('button').find((b) => b.text() === 'Discard my changes')!
    await discard.trigger('click')
    await flushPromises()
    expect((wrapper.get('#syncjob-exclude').element as HTMLInputElement).value).toBe(
      '(?i)spam|(?i)junk',
    )
    expect((wrapper.get('#syncjob-intervalMinutes').element as HTMLInputElement).value).toBe('45')
  })

  it('adds the running note after saving a running job', async () => {
    const { wrapper } = await open('/sync-jobs/4?edit=syncjob')
    await wrapper.get('#syncjob-intervalMinutes').setValue('33')
    await wrapper.get('#section-syncjob form').trigger('submit')
    await settle(() =>
      expect(wrapper.text()).toContain(
        'The run in progress is not interrupted and finishes on its own.',
      ),
    )
  })

  it('checks the values before sending', async () => {
    const { wrapper } = await open('/sync-jobs/2?edit=syncjob')
    await wrapper.get('#syncjob-intervalMinutes').setValue('0')
    await wrapper.get('#syncjob-remoteHost').setValue('')
    await wrapper.get('#section-syncjob form').trigger('submit')
    await flushPromises()
    expect(updates()).toHaveLength(0)
    expect(wrapper.text()).toContain('Enter a value from 1 to 43,800.')
    expect(wrapper.text()).toContain('This field is required.')
  })
})
