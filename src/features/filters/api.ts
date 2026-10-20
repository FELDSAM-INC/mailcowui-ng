import { useQuery, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import {
  api,
  ApiProblem,
  queryKeys,
  requireData,
  runMutation,
  type SieveFilter,
  type SieveFilterCreateRequest,
  type SieveFilterListParams,
  type SieveFilterPatch,
} from '@/api'

export function useFilters(
  params: MaybeRefOrGetter<SieveFilterListParams>,
  mailbox: MaybeRefOrGetter<string> = '',
) {
  return useQuery(
    computed(() => ({
      queryKey: toValue(mailbox)
        ? queryKeys.sieveFilters.mailbox(toValue(mailbox), toValue(params))
        : queryKeys.sieveFilters.list(toValue(params)),
      queryFn: async () => {
        const { mailbox: ignored, ...query } = toValue(params)
        void ignored
        return requireData(
          toValue(mailbox)
            ? await api.GET('/mailboxes/{mailbox}/sieve-filters', {
                params: { path: { mailbox: toValue(mailbox) }, query },
              })
            : await api.GET('/sieve-filters', { params: { query: toValue(params) } }),
        )
      },
      staleTime: 30_000,
    })),
  )
}
export async function fetchFilter(mailbox: string, id: number): Promise<SieveFilter> {
  return requireData(
    await api.GET('/mailboxes/{mailbox}/sieve-filters/{sieveFilterId}', {
      params: { path: { mailbox, sieveFilterId: id } },
    }),
  ).data
}
export function useFilter(id: MaybeRefOrGetter<number>, mailbox: MaybeRefOrGetter<string> = '') {
  return useQuery(
    computed(() => ({
      queryKey: queryKeys.sieveFilters.detail(toValue(mailbox), toValue(id)),
      queryFn: async () => {
        if (toValue(mailbox)) return fetchFilter(toValue(mailbox), toValue(id))
        const result = requireData(
          await api.GET('/sieve-filters', { params: { query: { id: toValue(id), limit: 1 } } }),
        ).data[0]
        if (!result) throw ApiProblem.fromParts({ kind: 'problem', status: 404 })
        return result
      },
      enabled: Number.isSafeInteger(toValue(id)) && toValue(id) > 0,
      staleTime: 30_000,
    })),
  )
}
export function useActiveScript(mailbox: MaybeRefOrGetter<string>) {
  return useQuery(
    computed(() => ({
      queryKey: queryKeys.selfService.activeSieveScript(toValue(mailbox)),
      queryFn: async () =>
        requireData(
          await api.GET('/mailboxes/{mailbox}/active-sieve-script', {
            params: { path: { mailbox: toValue(mailbox) } },
          }),
        ).data,
      staleTime: 30_000,
      enabled: !!toValue(mailbox),
    })),
  )
}
export async function validateScript(script: string) {
  return requireData(await api.POST('/sieve-filters/validation', { body: { script } })).data
}
function changed(client: QueryClient, mailbox: string) {
  void client.invalidateQueries({ queryKey: queryKeys.sieveFilters.all() })
  void client.invalidateQueries({ queryKey: queryKeys.selfService.activeSieveScript(mailbox) })
  void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
}
export function createFilter(client: QueryClient, mailbox: string, body: SieveFilterCreateRequest) {
  return runMutation(
    client,
    {
      mutationFn: async () =>
        requireData(
          await api.POST('/mailboxes/{mailbox}/sieve-filters', {
            params: { path: { mailbox } },
            body,
          }),
        ).data,
      onSuccess: () => changed(client, mailbox),
    },
    undefined,
  )
}
export function updateFilter(client: QueryClient, item: SieveFilter, body: SieveFilterPatch) {
  return runMutation(
    client,
    {
      mutationFn: async () =>
        requireData(
          await api.PATCH('/mailboxes/{mailbox}/sieve-filters/{sieveFilterId}', {
            params: {
              path: { mailbox: item.mailbox, sieveFilterId: item.id },
              header: { 'If-Match': item.etag },
            },
            body,
            headers: { 'Content-Type': 'application/merge-patch+json' },
          }),
        ).data,
      onSuccess: () => changed(client, item.mailbox),
    },
    undefined,
  )
}
export function deleteFilter(client: QueryClient, item: SieveFilter): Promise<void> {
  return runMutation(
    client,
    {
      mutationFn: async () => {
        await api.DELETE('/mailboxes/{mailbox}/sieve-filters/{sieveFilterId}', {
          params: {
            path: { mailbox: item.mailbox, sieveFilterId: item.id },
            header: { 'If-Match': item.etag },
          },
        })
      },
      onSuccess: () => {
        client.removeQueries({ queryKey: queryKeys.sieveFilters.detail(item.mailbox, item.id) })
        changed(client, item.mailbox)
      },
    },
    undefined,
  )
}
