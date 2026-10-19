// The recipient map data layer (research R14, data-model §3): list, detail, create, update, delete and
// bulk actions as mutations, each invalidating the `recipient-maps` root.
import { queryOptions, type QueryClient } from '@tanstack/vue-query'

import {
  api,
  queryKeys,
  requireData,
  runMutation,
  type RecipientMap,
  type RecipientMapBulkActionRequest,
  type RecipientMapCreateRequest,
  type RecipientMapListParams,
  type RecipientMapPatch,
  type BulkResult,
} from '@/api'

import { cachedEntry, forgetOnNotFound, invalidate, LIST_STALE_TIME, type Page } from './common'

export async function fetchRecipientMaps(
  params: RecipientMapListParams,
): Promise<Page<RecipientMap>> {
  return requireData(await api.GET('/recipient-maps', { params: { query: params } }))
}

export async function fetchRecipientMap(id: number): Promise<RecipientMap> {
  return requireData(
    await api.GET('/recipient-maps/{recipientMapId}', { params: { path: { recipientMapId: id } } }),
  ).data
}

export function recipientMapOptions(client: QueryClient, id: number) {
  const cached = () => cachedEntry<RecipientMap>(client, queryKeys.recipientMaps.lists(), id)
  return queryOptions({
    queryKey: queryKeys.recipientMaps.detail(id),
    queryFn: () => fetchRecipientMap(id),
    staleTime: LIST_STALE_TIME,
    initialData: () => cached()?.entry,
    initialDataUpdatedAt: () => cached()?.updatedAt,
  })
}

function afterChange(client: QueryClient, map?: RecipientMap) {
  if (map) client.setQueryData(queryKeys.recipientMaps.detail(map.id), map)
  return invalidate(client, queryKeys.recipientMaps.lists())
}

export function createRecipientMap(
  client: QueryClient,
  body: RecipientMapCreateRequest,
): Promise<RecipientMap> {
  return runMutation<RecipientMap, RecipientMapCreateRequest>(
    client,
    {
      mutationFn: async (request) =>
        requireData(await api.POST('/recipient-maps', { body: request })).data,
      onSuccess: (map) => afterChange(client, map),
    },
    body,
  )
}

export function updateRecipientMap(
  client: QueryClient,
  id: number,
  patch: RecipientMapPatch,
  ifMatch: string,
): Promise<RecipientMap> {
  return runMutation<RecipientMap, RecipientMapPatch>(
    client,
    {
      mutationFn: async (body) =>
        requireData(
          await api.PATCH('/recipient-maps/{recipientMapId}', {
            params: { path: { recipientMapId: id }, header: { 'If-Match': ifMatch } },
            body,
            headers: { 'Content-Type': 'application/merge-patch+json' },
          }),
        ).data,
      onSuccess: (map) => afterChange(client, map),
      onError: (error) =>
        forgetOnNotFound(
          client,
          error,
          queryKeys.recipientMaps.detail(id),
          queryKeys.recipientMaps.lists(),
        ),
    },
    patch,
  )
}

export function deleteRecipientMap(
  client: QueryClient,
  id: number,
  ifMatch: string,
): Promise<void> {
  return runMutation<void, void>(
    client,
    {
      mutationFn: async () => {
        await api.DELETE('/recipient-maps/{recipientMapId}', {
          params: { path: { recipientMapId: id }, header: { 'If-Match': ifMatch } },
        })
      },
      onSuccess: async () => {
        client.removeQueries({ queryKey: queryKeys.recipientMaps.detail(id) })
        await afterChange(client)
      },
      onError: (error) =>
        forgetOnNotFound(
          client,
          error,
          queryKeys.recipientMaps.detail(id),
          queryKeys.recipientMaps.lists(),
        ),
    },
    undefined,
  )
}

export function applyRecipientMapBulkAction(
  client: QueryClient,
  request: RecipientMapBulkActionRequest,
): Promise<BulkResult> {
  return runMutation<BulkResult, RecipientMapBulkActionRequest>(
    client,
    {
      mutationFn: async (body) =>
        requireData(await api.POST('/recipient-maps/bulk-actions', { body })).data,
      onSuccess: () => invalidate(client, queryKeys.recipientMaps.all()),
    },
    request,
  )
}
