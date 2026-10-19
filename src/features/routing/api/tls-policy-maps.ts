// The TLS policy map data layer (research R14, data-model §3): list, detail, create, update, delete and
// bulk actions as mutations, each invalidating the `tls-policy-maps` root.
import { queryOptions, type QueryClient } from '@tanstack/vue-query'

import {
  api,
  queryKeys,
  requireData,
  runMutation,
  type TlsPolicyMap,
  type TlsPolicyMapBulkActionRequest,
  type TlsPolicyMapCreateRequest,
  type TlsPolicyMapListParams,
  type TlsPolicyMapPatch,
  type BulkResult,
} from '@/api'

import { cachedEntry, forgetOnNotFound, invalidate, LIST_STALE_TIME, type Page } from './common'

export async function fetchTlsPolicyMaps(
  params: TlsPolicyMapListParams,
): Promise<Page<TlsPolicyMap>> {
  return requireData(await api.GET('/tls-policy-maps', { params: { query: params } }))
}

export async function fetchTlsPolicyMap(id: number): Promise<TlsPolicyMap> {
  return requireData(
    await api.GET('/tls-policy-maps/{tlsPolicyMapId}', {
      params: { path: { tlsPolicyMapId: id } },
    }),
  ).data
}

export function tlsPolicyMapOptions(client: QueryClient, id: number) {
  const cached = () => cachedEntry<TlsPolicyMap>(client, queryKeys.tlsPolicyMaps.lists(), id)
  return queryOptions({
    queryKey: queryKeys.tlsPolicyMaps.detail(id),
    queryFn: () => fetchTlsPolicyMap(id),
    staleTime: LIST_STALE_TIME,
    initialData: () => cached()?.entry,
    initialDataUpdatedAt: () => cached()?.updatedAt,
  })
}

function afterChange(client: QueryClient, map?: TlsPolicyMap) {
  if (map) client.setQueryData(queryKeys.tlsPolicyMaps.detail(map.id), map)
  return invalidate(client, queryKeys.tlsPolicyMaps.lists())
}

export function createTlsPolicyMap(
  client: QueryClient,
  body: TlsPolicyMapCreateRequest,
): Promise<TlsPolicyMap> {
  return runMutation<TlsPolicyMap, TlsPolicyMapCreateRequest>(
    client,
    {
      mutationFn: async (request) =>
        requireData(await api.POST('/tls-policy-maps', { body: request })).data,
      onSuccess: (map) => afterChange(client, map),
    },
    body,
  )
}

export function updateTlsPolicyMap(
  client: QueryClient,
  id: number,
  patch: TlsPolicyMapPatch,
  ifMatch: string,
): Promise<TlsPolicyMap> {
  return runMutation<TlsPolicyMap, TlsPolicyMapPatch>(
    client,
    {
      mutationFn: async (body) =>
        requireData(
          await api.PATCH('/tls-policy-maps/{tlsPolicyMapId}', {
            params: { path: { tlsPolicyMapId: id }, header: { 'If-Match': ifMatch } },
            body,
            headers: { 'Content-Type': 'application/merge-patch+json' },
          }),
        ).data,
      onSuccess: (map) => afterChange(client, map),
      onError: (error) =>
        forgetOnNotFound(
          client,
          error,
          queryKeys.tlsPolicyMaps.detail(id),
          queryKeys.tlsPolicyMaps.lists(),
        ),
    },
    patch,
  )
}

export function deleteTlsPolicyMap(
  client: QueryClient,
  id: number,
  ifMatch: string,
): Promise<void> {
  return runMutation<void, void>(
    client,
    {
      mutationFn: async () => {
        await api.DELETE('/tls-policy-maps/{tlsPolicyMapId}', {
          params: { path: { tlsPolicyMapId: id }, header: { 'If-Match': ifMatch } },
        })
      },
      onSuccess: async () => {
        client.removeQueries({ queryKey: queryKeys.tlsPolicyMaps.detail(id) })
        await afterChange(client)
      },
      onError: (error) =>
        forgetOnNotFound(
          client,
          error,
          queryKeys.tlsPolicyMaps.detail(id),
          queryKeys.tlsPolicyMaps.lists(),
        ),
    },
    undefined,
  )
}

export function applyTlsPolicyMapBulkAction(
  client: QueryClient,
  request: TlsPolicyMapBulkActionRequest,
): Promise<BulkResult> {
  return runMutation<BulkResult, TlsPolicyMapBulkActionRequest>(
    client,
    {
      mutationFn: async (body) =>
        requireData(await api.POST('/tls-policy-maps/bulk-actions', { body })).data,
      onSuccess: () => invalidate(client, queryKeys.tlsPolicyMaps.all()),
    },
    request,
  )
}
