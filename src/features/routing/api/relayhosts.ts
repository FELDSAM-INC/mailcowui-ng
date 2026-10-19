// The relayhost data layer (research R7, R22; data-model §3). `createRelayhost` and
// `updateRelayhost` can carry a password, so they are direct client calls run through
// `useSecretRequest` by the forms (never `useMutation`, conventions "Secrets"); the caller applies
// the cache updates with `afterRelayhostWrite`. Deletions and bulk actions are mutations.
import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  api,
  queryKeys,
  requireData,
  runMutation,
  type BulkResult,
  type Writable,
  type Relayhost,
  type RelayhostBulkActionRequest,
  type RelayhostCreateRequest,
  type RelayhostListParams,
  type RelayhostPatch,
  type RelayhostUsageEntry,
  type RelayhostUsageParams,
} from '@/api'

import {
  cachedEntry,
  forgetOnNotFound,
  invalidate,
  LIST_STALE_TIME,
  type Page,
  type WithDefaults,
} from './common'

export async function fetchRelayhosts(params: RelayhostListParams): Promise<Page<Relayhost>> {
  return requireData(await api.GET('/relayhosts', { params: { query: params } }))
}

export async function fetchRelayhost(id: number): Promise<Relayhost> {
  return requireData(
    await api.GET('/relayhosts/{relayhostId}', { params: { path: { relayhostId: id } } }),
  ).data
}

export function relayhostOptions(client: QueryClient, id: number) {
  const cached = () => cachedEntry<Relayhost>(client, queryKeys.relayhosts.lists(), id)
  return queryOptions({
    queryKey: queryKeys.relayhosts.detail(id),
    queryFn: () => fetchRelayhost(id),
    staleTime: LIST_STALE_TIME,
    initialData: () => cached()?.entry,
    initialDataUpdatedAt: () => cached()?.updatedAt,
  })
}

export function useRelayhost(id: MaybeRefOrGetter<number>) {
  const client = useQueryClient()
  return useQuery(computed(() => relayhostOptions(client, toValue(id))))
}

export async function fetchRelayhostUsage(
  id: number,
  params: RelayhostUsageParams,
): Promise<Page<RelayhostUsageEntry>> {
  return requireData(
    await api.GET('/relayhosts/{relayhostId}/usage', {
      params: { path: { relayhostId: id }, query: params },
    }),
  )
}

export function relayhostUsageOptions(id: number, params: RelayhostUsageParams) {
  return queryOptions({
    queryKey: queryKeys.relayhosts.usage(id, params),
    queryFn: () => fetchRelayhostUsage(id, params),
    staleTime: LIST_STALE_TIME,
  })
}

/** Direct call (it can carry a password): the caller applies `afterRelayhostWrite`. */
export async function createRelayhost(
  body: WithDefaults<Writable<RelayhostCreateRequest>, 'active'>,
): Promise<Relayhost> {
  return requireData(
    await api.POST('/relayhosts', { body: body as Writable<RelayhostCreateRequest> }),
  ).data
}

/** Direct call (it can carry a password): the caller applies `afterRelayhostWrite`. */
export async function updateRelayhost(
  id: number,
  patch: Writable<RelayhostPatch>,
  ifMatch: string,
): Promise<Relayhost> {
  return requireData(
    await api.PATCH('/relayhosts/{relayhostId}', {
      params: { path: { relayhostId: id }, header: { 'If-Match': ifMatch } },
      body: patch,
      headers: { 'Content-Type': 'application/merge-patch+json' },
    }),
  ).data
}

/** The cache updates of a create or update (data-model §3): host and state show in assignments. */
export function afterRelayhostWrite(client: QueryClient, relayhost: Relayhost): Promise<unknown> {
  client.setQueryData(queryKeys.relayhosts.detail(relayhost.id), relayhost)
  return invalidate(
    client,
    queryKeys.relayhosts.lists(),
    queryKeys.relayhostChoices.all(),
    queryKeys.relayhostAssignments.all(),
  )
}

/** A deletion clears assignments, which changes the version tags of domains and mailboxes. */
function afterRelayhostRemoval(client: QueryClient): Promise<unknown> {
  return invalidate(
    client,
    queryKeys.relayhosts.all(),
    queryKeys.relayhostChoices.all(),
    queryKeys.relayhostAssignments.all(),
    queryKeys.domains.details(),
    queryKeys.domains.lists(),
    queryKeys.mailboxes.details(),
    queryKeys.mailboxes.lists(),
  )
}

export function deleteRelayhost(client: QueryClient, id: number, ifMatch: string): Promise<void> {
  return runMutation<void, void>(
    client,
    {
      mutationFn: async () => {
        await api.DELETE('/relayhosts/{relayhostId}', {
          params: { path: { relayhostId: id }, header: { 'If-Match': ifMatch } },
        })
      },
      onSuccess: async () => {
        client.removeQueries({ queryKey: queryKeys.relayhosts.detail(id) })
        await afterRelayhostRemoval(client)
      },
      onError: (error) =>
        forgetOnNotFound(
          client,
          error,
          queryKeys.relayhosts.detail(id),
          queryKeys.relayhosts.lists(),
        ),
    },
    undefined,
  )
}

export function applyRelayhostBulkAction(
  client: QueryClient,
  request: RelayhostBulkActionRequest,
): Promise<BulkResult> {
  return runMutation<BulkResult, RelayhostBulkActionRequest>(
    client,
    {
      mutationFn: async (body) =>
        requireData(await api.POST('/relayhosts/bulk-actions', { body })).data,
      onSuccess: async (result) => {
        for (const item of result.results) {
          if (item.outcome === 'done' && request.action === 'delete') {
            client.removeQueries({ queryKey: queryKeys.relayhosts.detail(Number(item.id)) })
          }
        }
        if (request.action === 'delete') await afterRelayhostRemoval(client)
        else {
          await invalidate(
            client,
            queryKeys.relayhosts.all(),
            queryKeys.relayhostChoices.all(),
            queryKeys.relayhostAssignments.all(),
          )
        }
      },
    },
    request,
  )
}
