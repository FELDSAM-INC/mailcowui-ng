// The transport data layer (research R7, R10, R22; data-model §3). `createTransport` and
// `updateTransport` can carry a password, so they are direct client calls (never `useMutation`);
// they return `meta.affectedTransports`. Every transport write invalidates the whole `transports`
// root, because a credential change changes the version tags of the next hop's other transports.
import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  api,
  queryKeys,
  requireData,
  runMutation,
  type BulkResult,
  type Writable,
  type Transport,
  type TransportBulkActionRequest,
  type TransportCreateRequest,
  type TransportListParams,
  type TransportPatch,
  type TransportReference,
} from '@/api'

import {
  cachedEntry,
  forgetOnNotFound,
  invalidate,
  LIST_STALE_TIME,
  type Page,
  type WithDefaults,
} from './common'

export interface TransportWrite {
  transport: Transport
  affectedTransports: TransportReference[]
}

export async function fetchTransports(params: TransportListParams): Promise<Page<Transport>> {
  return requireData(await api.GET('/transports', { params: { query: params } }))
}

export function transportListOptions(params: TransportListParams) {
  return queryOptions({
    queryKey: queryKeys.transports.list(params),
    queryFn: () => fetchTransports(params),
    staleTime: LIST_STALE_TIME,
  })
}

export async function fetchTransport(id: number): Promise<Transport> {
  return requireData(
    await api.GET('/transports/{transportId}', { params: { path: { transportId: id } } }),
  ).data
}

export function transportOptions(client: QueryClient, id: number) {
  const cached = () => cachedEntry<Transport>(client, queryKeys.transports.lists(), id)
  return queryOptions({
    queryKey: queryKeys.transports.detail(id),
    queryFn: () => fetchTransport(id),
    staleTime: LIST_STALE_TIME,
    initialData: () => cached()?.entry,
    initialDataUpdatedAt: () => cached()?.updatedAt,
  })
}

export function useTransport(id: MaybeRefOrGetter<number>) {
  const client = useQueryClient()
  return useQuery(computed(() => transportOptions(client, toValue(id))))
}

/** Direct call (it can carry a password): the caller applies `afterTransportWrite`. */
export async function createTransport(
  body: WithDefaults<Writable<TransportCreateRequest>, 'active' | 'mxBased'>,
): Promise<TransportWrite> {
  const answer = requireData(
    await api.POST('/transports', { body: body as Writable<TransportCreateRequest> }),
  )
  return { transport: answer.data, affectedTransports: answer.meta.affectedTransports }
}

/** Direct call (it can carry a password): the caller applies `afterTransportWrite`. */
export async function updateTransport(
  id: number,
  patch: Writable<TransportPatch>,
  ifMatch: string,
): Promise<TransportWrite> {
  const answer = requireData(
    await api.PATCH('/transports/{transportId}', {
      params: { path: { transportId: id }, header: { 'If-Match': ifMatch } },
      body: patch,
      headers: { 'Content-Type': 'application/merge-patch+json' },
    }),
  )
  return { transport: answer.data, affectedTransports: answer.meta.affectedTransports }
}

export function afterTransportWrite(client: QueryClient, transport?: Transport): Promise<unknown> {
  if (transport) client.setQueryData(queryKeys.transports.detail(transport.id), transport)
  return invalidate(client, queryKeys.transports.all())
}

export function deleteTransport(client: QueryClient, id: number, ifMatch: string): Promise<void> {
  return runMutation<void, void>(
    client,
    {
      mutationFn: async () => {
        await api.DELETE('/transports/{transportId}', {
          params: { path: { transportId: id }, header: { 'If-Match': ifMatch } },
        })
      },
      onSuccess: async () => {
        client.removeQueries({ queryKey: queryKeys.transports.detail(id) })
        await invalidate(client, queryKeys.transports.all())
      },
      onError: (error) =>
        forgetOnNotFound(
          client,
          error,
          queryKeys.transports.detail(id),
          queryKeys.transports.lists(),
        ),
    },
    undefined,
  )
}

export function applyTransportBulkAction(
  client: QueryClient,
  request: TransportBulkActionRequest,
): Promise<BulkResult> {
  return runMutation<BulkResult, TransportBulkActionRequest>(
    client,
    {
      mutationFn: async (body) =>
        requireData(await api.POST('/transports/bulk-actions', { body })).data,
      onSuccess: () => invalidate(client, queryKeys.transports.all()),
    },
    request,
  )
}
