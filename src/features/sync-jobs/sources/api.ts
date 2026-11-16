import { queryOptions } from '@tanstack/vue-query'
import { api, requireData, queryKeys, type components, type paths, type Writable } from '@/api'
export type SyncSource = components['schemas']['SyncSource']
export type SourcePatch = Writable<components['schemas']['SyncSourcePatch']>
export type SourceCreate = Writable<components['schemas']['SyncSourceCreateRequest']>
export type SourceListParams = NonNullable<paths['/sync-sources']['get']['parameters']['query']>
export const sourceKey = [...queryKeys.syncJobs.all(), 'sources'] as const
export const sourceDetailKey = (id: number) => [...sourceKey, 'detail', id] as const
export async function fetchSources(params: SourceListParams) {
  return requireData(await api.GET('/sync-sources', { params: { query: params } }))
}
export function sourceListOptions(params: SourceListParams) {
  return queryOptions({
    queryKey: [...sourceKey, 'list', params],
    queryFn: () => fetchSources(params),
    staleTime: 30_000,
  })
}
export async function fetchSource(id: number) {
  return requireData(
    await api.GET('/sync-sources/{sourceId}', { params: { path: { sourceId: id } } }),
  ).data
}
export function sourceOptions(id: number) {
  return queryOptions({
    queryKey: sourceDetailKey(id),
    queryFn: () => fetchSource(id),
    staleTime: 15_000,
  })
}
export async function createSource(body: SourceCreate) {
  return requireData(await api.POST('/sync-sources', { body })).data
}
export async function updateSource(id: number, body: SourcePatch, etag: string) {
  return requireData(
    await api.PATCH('/sync-sources/{sourceId}', {
      params: { path: { sourceId: id }, header: { 'If-Match': etag } },
      body,
      headers: { 'Content-Type': 'application/merge-patch+json' },
    }),
  ).data
}
export async function deleteSource(id: number, etag: string) {
  await api.DELETE('/sync-sources/{sourceId}', {
    params: { path: { sourceId: id }, header: { 'If-Match': etag } },
  })
}
export async function refreshToken(id: number, etag: string) {
  return requireData(
    await api.POST('/sync-sources/{sourceId}/oauth/refresh', {
      params: { path: { sourceId: id }, header: { 'If-Match': etag } },
    }),
  ).data
}
export async function startConnection(id: number, mailbox: string) {
  return requireData(
    await api.POST('/sync-sources/{sourceId}/oauth/start', {
      params: { path: { sourceId: id } },
      body: { mailbox },
    }),
  ).data
}
export function connectionsOptions(id: number, mailbox: string) {
  return queryOptions({
    queryKey: [...sourceKey, 'connections', id, mailbox],
    queryFn: async () =>
      requireData(
        await api.GET('/sync-sources/{sourceId}/connections', {
          params: { path: { sourceId: id }, query: { mailbox } },
        }),
      ).data,
    staleTime: 15_000,
  })
}
export async function disconnect(id: number, mailbox: string, remoteUser: string) {
  await api.DELETE('/sync-sources/{sourceId}/connections', {
    params: { path: { sourceId: id } },
    body: { mailbox, remoteUser },
  })
}
