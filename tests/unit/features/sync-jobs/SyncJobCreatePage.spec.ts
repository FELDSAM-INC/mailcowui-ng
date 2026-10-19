// The create page (UI 008 T043): the capabilities read first, the body from the form model, the
// owner for managers only, the existing-job alert with its link, the error summary after a refusal,
// `router.replace` to the new job on success, and the leave guard only while the form holds input.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import SyncJobCreatePage from '@/features/sync-jobs/pages/SyncJobCreatePage.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import { confirmState } from '@/shared/composables/useConfirm'

import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

const mounted: { unmount(): void }[] = []
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})
const settle = (check: () => void) => vi.waitFor(check, { timeout: 5000 })

async function open(path: string, scenario: string) {
  useScenario(scenario)
  const router = createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [
      { path: '/sync-jobs', name: 'sync-jobs', component: { render: () => null } },
      { path: '/sync-jobs/new', name: 'sync-job-create', component: SyncJobCreatePage },
      { path: '/sync-jobs/:syncJobId', name: 'sync-job-detail', component: { render: () => null } },
    ],
  })
  await router.push('/sync-jobs')
  await router.push(path)
  await router.isReady()
  const wrapper = mountWithApp(
    { components: { ConfirmDialog }, template: '<div><RouterView /><ConfirmDialog /></div>' },
    { global: { plugins: [router] }, attachTo: document.body },
  )
  mounted.push(wrapper)
  await flushPromises()
  await settle(() => expect(wrapper.find('#syncjob-create-remoteHost').exists()).toBe(true))
  return { wrapper, router }
}

const creates = () => mockState().requests.filter((r) => r.operationId === 'createSyncJob')

async function fill(
  wrapper: Awaited<ReturnType<typeof open>>['wrapper'],
  host = 'imap.unit.example',
  user = 'unit',
) {
  await wrapper.get('#syncjob-create-remoteHost').setValue(host)
  await wrapper.get('#syncjob-create-remoteUser').setValue(user)
  await wrapper.get('#syncjob-create-remotePassword').setValue('Unit-Secret')
}

describe('SyncJobCreatePage', () => {
  it("creates a mailbox user's job without a mailbox and replaces the address with the job", async () => {
    const { wrapper, router } = await open('/sync-jobs/new', 'sync-jobs-user')
    expect(wrapper.find('#syncjob-create-mailbox').exists()).toBe(false)
    await fill(wrapper)
    const replace = vi.spyOn(router, 'replace')
    await wrapper.get('form').trigger('submit')
    await settle(() => expect(router.currentRoute.value.name).toBe('sync-job-detail'))
    expect(replace).toHaveBeenCalled()
    expect(creates()[0]!.body).toMatchObject({
      remoteHost: 'imap.unit.example',
      intervalMinutes: 20,
    })
    expect(creates()[0]!.body).not.toHaveProperty('mailbox')
  })

  it('preselects the owner from the address and sends it', async () => {
    const { wrapper, router } = await open(
      '/sync-jobs/new?mailbox=dora%40example.org',
      'sync-jobs-admin',
    )
    await fill(wrapper)
    await wrapper.get('form').trigger('submit')
    await settle(() => expect(router.currentRoute.value.name).toBe('sync-job-detail'))
    expect(creates()[0]!.body).toMatchObject({ mailbox: 'dora@example.org' })
  })

  it('shows an existing job with its link and keeps the values', async () => {
    const { wrapper } = await open('/sync-jobs/new?mailbox=alice%40example.org', 'sync-jobs-admin')
    await fill(wrapper, 'mail.previous.example', 'alice')
    await wrapper.get('form').trigger('submit')
    await settle(() =>
      expect(wrapper.text()).toContain('Object mail.previous.example / alice already exists'),
    )
    expect(wrapper.get('a[href="/ng/sync-jobs/2"]').text()).toBe('Open the existing job')
    expect((wrapper.get('#syncjob-create-remoteHost').element as HTMLInputElement).value).toBe(
      'mail.previous.example',
    )
  })

  it('checks the values first and focuses the error summary', async () => {
    const { wrapper } = await open('/sync-jobs/new', 'sync-jobs-admin')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(creates()).toHaveLength(0)
    expect(wrapper.text()).toContain('No user defined')
    expect(document.activeElement?.id).toMatch(/^error-summary-/)
  })

  it('asks before leaving only while the form holds input', async () => {
    const { wrapper, router } = await open('/sync-jobs/new', 'sync-jobs-admin')
    await router.push('/sync-jobs')
    expect(confirmState.value).toBeNull()
    await router.push('/sync-jobs/new')
    await settle(() => expect(wrapper.find('#syncjob-create-remoteHost').exists()).toBe(true))
    await wrapper.get('#syncjob-create-remoteHost').setValue('imap.x.example')
    void router.push('/sync-jobs')
    await flushPromises()
    expect(confirmState.value?.title).toBe('Leave without saving?')
  })
})
