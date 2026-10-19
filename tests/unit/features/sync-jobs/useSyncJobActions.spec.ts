// The sync-job actions (UI 008 T057, T070): the bulk request with the versions as listed (quotes
// removed) and the bulk limit, the confirmation of deactivating and of removing (with the typed
// count), per-job rows with failed jobs kept selected, a lost connection as "outcome unknown" with
// the selection cleared, and the single removal with If-Match and a new confirmation after 412.
import { QueryClient } from '@tanstack/vue-query'
import { flushPromises } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { syncJobListOptions } from '@/features/sync-jobs/api'
import { useSyncJobActions } from '@/features/sync-jobs/composables/useSyncJobActions'
import * as confirmModule from '@/shared/composables/useConfirm'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'

import { applyOverrides } from '../../../mocks/scenarios'
import { mockState, server, useScenario } from '../../../mocks/node'
import { withSetup } from '../../support/composable'
import { testPlugins } from '../../support/mount'

const params = { limit: 25, offset: 0, sort: 'id', order: 'asc' } as const

async function setup(scenario = 'sync-jobs-bulk', role: 'admin' | 'mailboxUser' = 'admin') {
  useScenario(scenario)
  const client: QueryClient = testPlugins().queryClient
  const page = await client.fetchQuery(syncJobListOptions(params))
  const { result, unmount } = withSetup(() => {
    const selection = useBulkSelection({ limit: () => 100 })
    const actions = useSyncJobActions({ selection, entries: () => page.data, role: () => role })
    return { selection, actions }
  })
  mounted.push(unmount)
  return { ...result, page }
}

const mounted: (() => void)[] = []
afterEach(() => {
  for (const unmount of mounted.splice(0)) unmount()
  vi.restoreAllMocks()
})

const bulkRequests = () =>
  mockState().requests.filter((request) => request.operationId === 'applySyncJobBulkAction')

describe('useSyncJobActions: selections', () => {
  it('sends one request with the versions without quotes and keeps the failed job selected', async () => {
    const { selection, actions, page } = await setup()
    selection.enter()
    for (const id of ['6', '7', '8']) selection.toggle(id)
    await actions.run('activate')
    const body = bulkRequests()[0]!.body as { targets: { id: string; version: string }[] }
    expect(body.targets.map((t) => t.id)).toEqual(['6', '7', '8'])
    expect(body.targets[0]!.version).toBe(
      page.data.find((job) => job.id === 6)!.etag.replace(/"/g, ''),
    )
    expect(actions.rows.value.map((row) => [row.id, row.outcome])).toEqual([
      ['6', 'done'],
      ['7', 'failed'],
      ['8', 'done'],
    ])
    expect(actions.rows.value[1]!.label).toBe(
      'user7@old-provider.example@imap7.old-provider.example:993',
    )
    expect([...selection.ids.value]).toEqual(['7'])
  })

  it('confirms deactivating with the jobs listed and sends nothing on cancel', async () => {
    const ask = vi.spyOn(confirmModule, 'confirm').mockResolvedValue(false)
    const { selection, actions } = await setup()
    selection.enter()
    selection.toggle('1')
    await actions.run('deactivate')
    expect(ask.mock.calls[0]![0]).toMatchObject({
      title: 'Deactivate 1 sync jobs?',
      confirmLabel: 'Deactivate',
    })
    expect(bulkRequests()).toHaveLength(0)
    ask.mockResolvedValue(true)
    await actions.run('reschedule')
    expect(ask).toHaveBeenCalledTimes(1)
    expect(bulkRequests()).toHaveLength(1)
  })

  it('confirms removing a selection with the number typed', async () => {
    const ask = vi.spyOn(confirmModule, 'confirm').mockResolvedValue(true)
    const { selection, actions } = await setup()
    selection.enter()
    selection.toggle('1')
    selection.toggle('2')
    await actions.run('delete')
    expect(ask.mock.calls[0]![0]).toMatchObject({
      title: 'Confirm deletion',
      confirmLabel: 'Delete now',
      destructive: true,
      requireTyped: { accepted: ['2'] },
    })
    expect(actions.rows.value.every((row) => row.outcome === 'done')).toBe(true)
  })

  it('reports a lost connection as unknown, clears the selection and retries nothing', async () => {
    const { selection, actions } = await setup()
    selection.enter()
    selection.toggle('1')
    server.use(http.post('*/api/v2/sync-jobs/bulk-actions', () => HttpResponse.error()))
    await actions.run('activate')
    expect(actions.rows.value.map((row) => row.outcome)).toEqual(['unknown'])
    expect(selection.count.value).toBe(0)
  })

  it('retries the kept jobs with the refreshed versions', async () => {
    const { selection, actions } = await setup()
    selection.enter()
    selection.toggle('7')
    await actions.run('activate')
    expect(actions.rows.value[0]!.outcome).toBe('failed')
    applyOverrides(mockState(), { syncJobs: { failBulkItems: [] } })
    await actions.retry()
    expect(bulkRequests()).toHaveLength(2)
    expect(actions.rows.value[0]!.outcome).toBe('done')
  })
})

describe('useSyncJobActions: removing one job', () => {
  it("confirms, sends If-Match and announces legacy's message", async () => {
    const ask = vi.spyOn(confirmModule, 'confirm').mockResolvedValue(true)
    const { actions, page } = await setup('sync-jobs-admin')
    const job = page.data.find((item) => item.id === 2)!
    await actions.removeOne(job)
    expect(ask.mock.calls[0]![0]).toMatchObject({
      title: 'Confirm deletion',
      confirmLabel: 'Delete now',
    })
    const request = mockState().requests.find((r) => r.operationId === 'deleteSyncJob')!
    expect(request.headers['if-match']).toBe(job.etag)
    expect(actions.status.value).toBe('Deleted syncjob ID 2')
  })

  it('asks again after a 412 and stops when the user cancels', async () => {
    const ask = vi
      .spyOn(confirmModule, 'confirm')
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    const { actions, page } = await setup('sync-jobs-admin')
    const job = page.data.find((item) => item.id === 2)!
    applyOverrides(mockState(), { syncJobs: { changeElsewhere: { id: 2, intervalMinutes: 45 } } })
    await actions.removeOne(job)
    await flushPromises()
    expect(ask).toHaveBeenCalledTimes(2)
    const statuses = mockState()
      .requests.filter((r) => r.operationId === 'deleteSyncJob')
      .map((r) => r.status)
    expect(statuses).toEqual([412])
  })
})
