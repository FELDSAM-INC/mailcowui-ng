// The sync-job data layer (UI 008 research R5, data-model §3). Queries are keyed under
// `['sync-jobs', …]`. Create and edit can carry passwords, so they bypass the mutation cache.
// All writes retain session checks/reactions, cache only the returned job metadata, invalidate
// the lists and audit log, and forget jobs that are gone (FR-033).
import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  api,
  isApiProblem,
  queryKeys,
  reportSessionProblem,
  requireData,
  runMutation,
  type BulkResult,
  type ListMeta,
  type SyncJob,
  type SyncJobBulkActionRequest,
  type SyncJobCapabilities,
  type SyncJobCreateRequest,
  type SyncJobListParams,
  type SyncJobLog,
  type SyncJobPatch,
  type Writable,
} from '@/api'
import { captureSessionScope } from '@/api/session-scope'

export interface SyncJobPage {
  data: SyncJob[]
  meta: ListMeta
}

const MERGE_PATCH = { 'Content-Type': 'application/merge-patch+json' }

// Queries

export function syncJobListOptions(params: SyncJobListParams) {
  return queryOptions({
    queryKey: queryKeys.syncJobs.list(params),
    queryFn: async (): Promise<SyncJobPage> =>
      requireData(await api.GET('/sync-jobs', { params: { query: params } })),
    staleTime: 30_000,
  })
}

/** A job from a cached list, with that list's update time (UI 002 D6). */
function cachedJob(
  client: QueryClient,
  id: number,
): { job: SyncJob; updatedAt: number } | undefined {
  for (const [key, page] of client.getQueriesData<SyncJobPage>({
    queryKey: queryKeys.syncJobs.lists(),
  })) {
    const job = page?.data.find((item) => item.id === id)
    if (job) return { job, updatedAt: client.getQueryState(key)?.dataUpdatedAt ?? 0 }
  }
  return undefined
}

export async function fetchSyncJob(id: number): Promise<SyncJob> {
  return requireData(
    await api.GET('/sync-jobs/{syncJobId}', { params: { path: { syncJobId: id } } }),
  ).data
}

/** The detail, seeded from a cached list entry (list entries carry the version tag, API FR-015). */
export function syncJobOptions(client: QueryClient, id: number) {
  return queryOptions({
    queryKey: queryKeys.syncJobs.detail(id),
    queryFn: () => fetchSyncJob(id),
    staleTime: 30_000,
    initialData: () => cachedJob(client, id)?.job,
    initialDataUpdatedAt: () => cachedJob(client, id)?.updatedAt,
  })
}

export function useSyncJob(
  id: MaybeRefOrGetter<number>,
  enabled: MaybeRefOrGetter<boolean> = true,
) {
  const client = useQueryClient()
  return useQuery(
    computed(() => ({ ...syncJobOptions(client, toValue(id)), enabled: toValue(enabled) })),
  )
}

/** The log is fetched only when the viewer opens and released soon after (FR-046, R17). */
export function logOptions(id: number) {
  return queryOptions({
    queryKey: queryKeys.syncJobs.log(id),
    queryFn: async (): Promise<SyncJobLog> =>
      requireData(
        await api.GET('/sync-jobs/{syncJobId}/log', { params: { path: { syncJobId: id } } }),
      ).data,
    staleTime: 30_000,
    gcTime: 60_000,
  })
}

export function useSyncJobLog(id: MaybeRefOrGetter<number>, enabled: MaybeRefOrGetter<boolean>) {
  return useQuery(computed(() => ({ ...logOptions(toValue(id)), enabled: toValue(enabled) })))
}

/** Server configuration for the caller, read lazily (R10). */
export function capabilitiesOptions() {
  return queryOptions({
    queryKey: queryKeys.syncJobs.capabilities(),
    queryFn: async (): Promise<SyncJobCapabilities> =>
      requireData(await api.GET('/capabilities/sync-jobs')).data,
    staleTime: 300_000,
  })
}

export function useSyncJobCapabilities(enabled: MaybeRefOrGetter<boolean> = true) {
  return useQuery(computed(() => ({ ...capabilitiesOptions(), enabled: toValue(enabled) })))
}

// Cache rules shared by the mutations

function invalidateAudit(client: QueryClient) {
  return client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
}

function invalidateLists(client: QueryClient) {
  return client.invalidateQueries({ queryKey: queryKeys.syncJobs.lists() })
}

/** Writes a job to its detail and to every cached list page that holds it (FR-014). */
export function writeSyncJob(client: QueryClient, job: SyncJob): void {
  client.setQueryData(queryKeys.syncJobs.detail(job.id), job)
  client.setQueriesData<SyncJobPage>({ queryKey: queryKeys.syncJobs.lists() }, (page) =>
    page ? { ...page, data: page.data.map((item) => (item.id === job.id ? job : item)) } : page,
  )
}

/** A job that no longer exists or left the scope: remove its caches, refresh the lists. */
export function forgetSyncJob(client: QueryClient, id: number): void {
  client.removeQueries({ queryKey: queryKeys.syncJobs.detail(id) })
  client.removeQueries({ queryKey: queryKeys.syncJobs.log(id) })
  void invalidateLists(client)
}

function onJobError(client: QueryClient, id: number, error: unknown): void {
  if (isApiProblem(error) && error.status === 404) forgetSyncJob(client, id)
}

// Mutations

/** Password-bearing writes must never create a mutation entry, even while pending or failed. */
async function saveSyncJob(
  client: QueryClient,
  request: () => Promise<SyncJob>,
  id?: number,
): Promise<SyncJob> {
  const scope = captureSessionScope()
  try {
    const job = await scope.run(request)
    await scope.run(async () => {
      writeSyncJob(client, job)
      await Promise.all([invalidateLists(client), invalidateAudit(client)])
    })
    return job
  } catch (error) {
    scope.assertCurrent()
    if (id !== undefined) onJobError(client, id, error)
    reportSessionProblem(error)
    throw error
  }
}

/**
 * The create body as sent: the password is a plain value (`writeOnly` in the contract); an omitted
 * member takes its default (custom parameters are left out when the caller may not set them).
 */
export type SyncJobCreateBody = Partial<Writable<SyncJobCreateRequest>> &
  Pick<Writable<SyncJobCreateRequest>, 'remoteUser'>

export function createSyncJob(client: QueryClient, body: SyncJobCreateBody): Promise<SyncJob> {
  return saveSyncJob(
    client,
    async () =>
      requireData(await api.POST('/sync-jobs', { body: body as Writable<SyncJobCreateRequest> }))
        .data,
  )
}

export type SyncJobPatchBody = Writable<SyncJobPatch>

export function updateSyncJob(
  client: QueryClient,
  id: number,
  patch: SyncJobPatchBody,
  ifMatch: string,
): Promise<SyncJob> {
  return saveSyncJob(
    client,
    async () =>
      requireData(
        await api.PATCH('/sync-jobs/{syncJobId}', {
          params: { path: { syncJobId: id }, header: { 'If-Match': ifMatch } },
          body: patch,
          headers: MERGE_PATCH,
        }),
      ).data,
    id,
  )
}

/** "Schedule next": changes only the run status, so no version tag is sent (API FR-021). */
export function rescheduleSyncJob(client: QueryClient, id: number): Promise<SyncJob> {
  return runMutation<SyncJob, void>(
    client,
    {
      mutationFn: async () =>
        requireData(
          await api.POST('/sync-jobs/{syncJobId}/schedule-reset', {
            params: { path: { syncJobId: id } },
          }),
        ).data,
      onSuccess: async (job) => {
        writeSyncJob(client, job)
        await Promise.all([invalidateLists(client), invalidateAudit(client)])
      },
      onError: (error) => onJobError(client, id, error),
    },
    undefined,
  )
}

export function deleteSyncJob(client: QueryClient, id: number, ifMatch: string): Promise<void> {
  return runMutation<void, void>(
    client,
    {
      mutationFn: async () => {
        await api.DELETE('/sync-jobs/{syncJobId}', {
          params: { path: { syncJobId: id }, header: { 'If-Match': ifMatch } },
        })
      },
      onSuccess: async () => {
        forgetSyncJob(client, id)
        await invalidateAudit(client)
      },
      onError: (error) => onJobError(client, id, error),
    },
    undefined,
  )
}

export function applySyncJobBulkAction(
  client: QueryClient,
  request: SyncJobBulkActionRequest,
): Promise<BulkResult> {
  return runMutation<BulkResult, SyncJobBulkActionRequest>(
    client,
    {
      mutationFn: async (body) =>
        requireData(await api.POST('/sync-jobs/bulk-actions', { body })).data,
      onSuccess: async (result, body) => {
        for (const item of result.results) {
          const id = Number(item.id)
          if (
            item.outcome === 'notFound' ||
            (item.outcome === 'done' && body.action === 'delete')
          ) {
            client.removeQueries({ queryKey: queryKeys.syncJobs.detail(id) })
            client.removeQueries({ queryKey: queryKeys.syncJobs.log(id) })
          } else if (item.outcome === 'done') {
            void client.invalidateQueries({ queryKey: queryKeys.syncJobs.detail(id) })
          }
        }
        await Promise.all([invalidateLists(client), invalidateAudit(client)])
      },
    },
    request,
  )
}
