import { queryOptions, type QueryClient } from '@tanstack/vue-query'
import {
  api,
  queryKeys,
  requireData,
  type MassMailSelection,
  type MassMailJobCreateRequest,
  type MassMailJobListParams,
  type MassMailRecipientListParams,
  type MassMailPreviewParams,
} from '@/api'
import { selectionKey } from '../lib/selection'

export async function previewRecipients(
  selection: MassMailSelection,
  params: MassMailPreviewParams,
  signal?: AbortSignal,
) {
  return requireData(
    await api.POST('/mass-mail-jobs/recipient-preview', {
      body: { selection },
      params: { query: params },
      signal,
    }),
  )
}
export function previewOptions(selection: MassMailSelection, params: MassMailPreviewParams) {
  return queryOptions({
    queryKey: queryKeys.massMailPreview(selectionKey(selection), params),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    queryFn: ({ signal }) => previewRecipients(selection, params, signal),
  })
}
export function jobListOptions(params: MassMailJobListParams) {
  return queryOptions({
    queryKey: queryKeys.massMailJobs.list(params),
    staleTime: 30_000,
    queryFn: async ({ signal }) =>
      requireData(await api.GET('/mass-mail-jobs', { params: { query: params }, signal })),
  })
}
export function runningJobOptions() {
  return queryOptions({
    queryKey: queryKeys.massMailJobs.running(),
    staleTime: 30_000,
    queryFn: async ({ signal }) =>
      requireData(
        await api.GET('/mass-mail-jobs', {
          params: { query: { status: 'running', limit: 1 } },
          signal,
        }),
      ),
  })
}
export function jobOptions(id: string) {
  return queryOptions({
    queryKey: queryKeys.massMailJobs.detail(id),
    staleTime: 0,
    gcTime: 0,
    queryFn: async ({ signal }) =>
      requireData(
        await api.GET('/mass-mail-jobs/{jobId}', { params: { path: { jobId: id } }, signal }),
      ).data,
  })
}
export function recipientOptions(id: string, params: MassMailRecipientListParams) {
  return queryOptions({
    queryKey: queryKeys.massMailJobs.recipients(id, params),
    staleTime: 30_000,
    queryFn: async ({ signal }) =>
      requireData(
        await api.GET('/mass-mail-jobs/{jobId}/recipients', {
          params: { path: { jobId: id }, query: params },
          signal,
        }),
      ),
  })
}
async function invalidateJobs(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.massMailJobs.lists() }),
    client.invalidateQueries({ queryKey: queryKeys.massMailJobs.running() }),
  ])
}
export async function createJob(body: MassMailJobCreateRequest, client: QueryClient) {
  const job = requireData(await api.POST('/mass-mail-jobs', { body })).data
  client.setQueryData(queryKeys.massMailJobs.detail(job.id), job)
  client.removeQueries({ queryKey: ['mass-mail-preview'] })
  await invalidateJobs(client)
  return job
}
export async function cancelJob(id: string, client: QueryClient) {
  const job = requireData(
    await api.POST('/mass-mail-jobs/{jobId}/cancellation', { params: { path: { jobId: id } } }),
  ).data
  client.setQueryData(queryKeys.massMailJobs.detail(id), job)
  await Promise.all([
    invalidateJobs(client),
    client.invalidateQueries({ queryKey: ['mass-mail-jobs', 'recipients', id] }),
  ])
  return job
}
