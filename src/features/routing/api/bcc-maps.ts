// The BCC map data layer (research R14, data-model §3): list, detail, create, update, delete and
// bulk actions as mutations (no password), each invalidating the `bcc-maps` root; the local
// destination choices for the picker.
import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  api,
  queryKeys,
  requireData,
  runMutation,
  type BccDestinationChoice,
  type BccDestinationChoiceParams,
  type BccMap,
  type BccMapBulkActionRequest,
  type BccMapCreateRequest,
  type BccMapListParams,
  type BccMapPatch,
  type BulkResult,
} from '@/api'

import { cachedEntry, forgetOnNotFound, invalidate, LIST_STALE_TIME, type Page } from './common'

export async function fetchBccMaps(params: BccMapListParams): Promise<Page<BccMap>> {
  return requireData(await api.GET('/bcc-maps', { params: { query: params } }))
}

export async function fetchBccMap(id: number): Promise<BccMap> {
  return requireData(await api.GET('/bcc-maps/{bccMapId}', { params: { path: { bccMapId: id } } }))
    .data
}

export function bccMapOptions(client: QueryClient, id: number) {
  const cached = () => cachedEntry<BccMap>(client, queryKeys.bccMaps.lists(), id)
  return queryOptions({
    queryKey: queryKeys.bccMaps.detail(id),
    queryFn: () => fetchBccMap(id),
    staleTime: LIST_STALE_TIME,
    initialData: () => cached()?.entry,
    initialDataUpdatedAt: () => cached()?.updatedAt,
  })
}

export function useBccMap(id: MaybeRefOrGetter<number>) {
  const client = useQueryClient()
  return useQuery(computed(() => bccMapOptions(client, toValue(id))))
}

export async function fetchBccDestinationChoices(
  params: BccDestinationChoiceParams,
): Promise<Page<BccDestinationChoice>> {
  return requireData(await api.GET('/bcc-destination-choices', { params: { query: params } }))
}

function afterChange(client: QueryClient, map?: BccMap) {
  if (map) client.setQueryData(queryKeys.bccMaps.detail(map.id), map)
  return invalidate(client, queryKeys.bccMaps.lists())
}

export function createBccMap(client: QueryClient, body: BccMapCreateRequest): Promise<BccMap> {
  return runMutation<BccMap, BccMapCreateRequest>(
    client,
    {
      mutationFn: async (request) =>
        requireData(await api.POST('/bcc-maps', { body: request })).data,
      onSuccess: (map) => afterChange(client, map),
    },
    body,
  )
}

export function updateBccMap(
  client: QueryClient,
  id: number,
  patch: BccMapPatch,
  ifMatch: string,
): Promise<BccMap> {
  return runMutation<BccMap, BccMapPatch>(
    client,
    {
      mutationFn: async (body) =>
        requireData(
          await api.PATCH('/bcc-maps/{bccMapId}', {
            params: { path: { bccMapId: id }, header: { 'If-Match': ifMatch } },
            body,
            headers: { 'Content-Type': 'application/merge-patch+json' },
          }),
        ).data,
      onSuccess: (map) => afterChange(client, map),
      onError: (error) =>
        forgetOnNotFound(client, error, queryKeys.bccMaps.detail(id), queryKeys.bccMaps.lists()),
    },
    patch,
  )
}

export function deleteBccMap(client: QueryClient, id: number, ifMatch: string): Promise<void> {
  return runMutation<void, void>(
    client,
    {
      mutationFn: async () => {
        await api.DELETE('/bcc-maps/{bccMapId}', {
          params: { path: { bccMapId: id }, header: { 'If-Match': ifMatch } },
        })
      },
      onSuccess: async () => {
        client.removeQueries({ queryKey: queryKeys.bccMaps.detail(id) })
        await afterChange(client)
      },
      onError: (error) =>
        forgetOnNotFound(client, error, queryKeys.bccMaps.detail(id), queryKeys.bccMaps.lists()),
    },
    undefined,
  )
}

export function applyBccMapBulkAction(
  client: QueryClient,
  request: BccMapBulkActionRequest,
): Promise<BulkResult> {
  return runMutation<BulkResult, BccMapBulkActionRequest>(
    client,
    {
      mutationFn: async (body) =>
        requireData(await api.POST('/bcc-maps/bulk-actions', { body })).data,
      onSuccess: () => invalidate(client, queryKeys.bccMaps.all()),
    },
    request,
  )
}
