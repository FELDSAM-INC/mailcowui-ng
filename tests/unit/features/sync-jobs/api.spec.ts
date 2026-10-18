// The sync-job data layer (UI 008 T015, research R5, data-model §3): query keys and freshness,
// the detail seeded from a cached list entry, the cache rules of every mutation, the version tag
// in If-Match (never for a reschedule), the merge-patch body, and no cache entry holding the
// submitted remote password.
import { QueryClient } from '@tanstack/vue-query'
import { beforeEach, describe, expect, it } from 'vitest'

import { ApiProblem, queryKeys, type SyncJob } from '@/api'
import {
  applySyncJobBulkAction,
  capabilitiesOptions,
  createSyncJob,
  deleteSyncJob,
  logOptions,
  rescheduleSyncJob,
  syncJobListOptions,
  syncJobOptions,
  updateSyncJob,
} from '@/features/sync-jobs/api'

import { mockState, useScenario } from '../../../mocks/node'

let client: QueryClient
const params = { limit: 25, offset: 0, sort: 'id', order: 'desc' } as const
const MARKER = 'Marker-Remote-Password-7'

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  useScenario('sync-jobs-admin')
})

const loadList = () => client.fetchQuery(syncJobListOptions(params))
const listed = (id: number) =>
  client
    .getQueriesData<{ data: SyncJob[] }>({ queryKey: queryKeys.syncJobs.lists() })
    .flatMap(([, page]) => page?.data ?? [])
    .find((job) => job.id === id)

function lastRequest(operationId: string) {
  return [...mockState().requests].reverse().find((r) => r.operationId === operationId)!
}

function cacheText(): string {
  return JSON.stringify(
    client
      .getQueryCache()
      .getAll()
      .map((query) => query.state.data),
  )
}

describe('queries', () => {
  it('keys the list, detail, log and capabilities with their freshness', () => {
    expect(syncJobListOptions(params).queryKey).toEqual(['sync-jobs', 'list', params])
    expect(syncJobListOptions(params).staleTime).toBe(30_000)
    expect(syncJobOptions(client, 2).queryKey).toEqual(['sync-jobs', 'detail', 2])
    expect(logOptions(2).queryKey).toEqual(['sync-jobs', 'log', 2])
    expect(logOptions(2)).toMatchObject({ staleTime: 30_000, gcTime: 60_000 })
    expect(capabilitiesOptions()).toMatchObject({
      queryKey: ['sync-jobs', 'capabilities'],
      staleTime: 300_000,
    })
  })

  it("seeds the detail from a cached list entry with that list's update time", async () => {
    await loadList()
    const options = syncJobOptions(client, 59)
    const initial = (options.initialData as () => SyncJob | undefined)()
    expect(initial?.id).toBe(59)
    const updatedAt = (options.initialDataUpdatedAt as () => number | undefined)()
    expect(updatedAt).toBe(client.getQueryState(syncJobListOptions(params).queryKey)?.dataUpdatedAt)
    expect((syncJobOptions(client, 1).initialData as () => SyncJob | undefined)()).toBeUndefined()
  })

  it('reads capabilities only when asked', async () => {
    const before = mockState().requests.length
    expect(client.getQueryData(capabilitiesOptions().queryKey)).toBeUndefined()
    expect(mockState().requests.length).toBe(before)
    const caps = await client.fetchQuery(capabilitiesOptions())
    expect(caps.bulkLimit).toBe(100)
  })
})

describe('mutations', () => {
  it('create writes the detail, invalidates lists and the audit log, and caches no password', async () => {
    await loadList()
    client.setQueryData(queryKeys.auditEvents.list({ limit: 25 }), { data: [], meta: {} })
    const created = await createSyncJob(client, {
      mailbox: 'dora@example.org',
      remoteHost: 'imap.created.example',
      remotePort: 993,
      remoteUser: 'dora.created',
      remotePassword: MARKER,
    })
    expect(client.getQueryData(queryKeys.syncJobs.detail(created.id))).toEqual(created)
    expect(client.getQueryState(syncJobListOptions(params).queryKey)?.isInvalidated).toBe(true)
    expect(client.getQueryState(queryKeys.auditEvents.list({ limit: 25 }))?.isInvalidated).toBe(
      true,
    )
    expect(cacheText()).not.toContain(MARKER)
  })

  it('update sends a merge patch with If-Match and replaces the cached list entry', async () => {
    await loadList()
    const before = listed(59)!
    const saved = await updateSyncJob(
      client,
      59,
      { intervalMinutes: 55, remotePassword: MARKER },
      before.etag,
    )
    const request = lastRequest('updateSyncJob')
    expect(request.headers['if-match']).toBe(before.etag)
    expect(request.headers['content-type']).toBe('application/merge-patch+json')
    expect(listed(59)?.intervalMinutes).toBe(55)
    expect(client.getQueryData(queryKeys.syncJobs.detail(59))).toEqual(saved)
    expect(cacheText()).not.toContain(MARKER)
  })

  it('reschedule sends no If-Match and writes the returned job', async () => {
    await loadList()
    const job = await rescheduleSyncJob(client, 2)
    expect(lastRequest('rescheduleSyncJob').headers['if-match']).toBeUndefined()
    expect(job.runStatus.lastRunAt).toBeNull()
    expect(client.getQueryData(queryKeys.syncJobs.detail(2))).toEqual(job)
  })

  it('delete removes the detail and the log and invalidates the lists', async () => {
    await loadList()
    const job = listed(58)!
    client.setQueryData(queryKeys.syncJobs.detail(58), job)
    client.setQueryData(queryKeys.syncJobs.log(58), { log: 'x' })
    await deleteSyncJob(client, 58, job.etag)
    expect(lastRequest('deleteSyncJob').headers['if-match']).toBe(job.etag)
    expect(client.getQueryData(queryKeys.syncJobs.detail(58))).toBeUndefined()
    expect(client.getQueryData(queryKeys.syncJobs.log(58))).toBeUndefined()
    expect(client.getQueryState(syncJobListOptions(params).queryKey)?.isInvalidated).toBe(true)
  })

  it('a 404 removes the detail and invalidates the lists', async () => {
    await loadList()
    const job = listed(57)!
    client.setQueryData(queryKeys.syncJobs.detail(57), job)
    mockState().syncJobs.jobs = mockState().syncJobs.jobs.filter((item) => item.id !== 57)
    await expect(updateSyncJob(client, 57, { active: false }, job.etag)).rejects.toBeInstanceOf(
      ApiProblem,
    )
    expect(client.getQueryData(queryKeys.syncJobs.detail(57))).toBeUndefined()
    expect(client.getQueryState(syncJobListOptions(params).queryKey)?.isInvalidated).toBe(true)
  })

  it('bulk invalidates lists, removes deleted details and invalidates the others', async () => {
    await loadList()
    const a = listed(56)!
    const b = listed(55)!
    client.setQueryData(queryKeys.syncJobs.detail(56), a)
    client.setQueryData(queryKeys.syncJobs.detail(55), b)
    await applySyncJobBulkAction(client, {
      action: 'delete',
      targets: [{ id: '56', version: a.etag.replace(/"/g, '') }],
    })
    expect(client.getQueryData(queryKeys.syncJobs.detail(56))).toBeUndefined()
    await applySyncJobBulkAction(client, { action: 'deactivate', targets: [{ id: '55' }] })
    expect(client.getQueryState(queryKeys.syncJobs.detail(55))?.isInvalidated).toBe(true)
    expect(client.getQueryState(syncJobListOptions(params).queryKey)?.isInvalidated).toBe(true)
  })
})
