import { useQuery, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import {
  api,
  queryKeys,
  requireData,
  runMutation,
  type TemporaryAliasCreateRequest,
  type TemporaryAliasListParams,
  type TemporaryAliasPatch,
} from '@/api'

export async function listTemporaryAliases(mailbox: string, params: TemporaryAliasListParams) {
  return requireData(
    await api.GET('/mailboxes/{mailbox}/temporary-aliases', {
      params: { path: { mailbox }, query: params },
    }),
  )
}
export function useTemporaryAliases(
  mailbox: MaybeRefOrGetter<string>,
  params: MaybeRefOrGetter<TemporaryAliasListParams>,
) {
  return useQuery(
    computed(() => ({
      queryKey: queryKeys.selfService.temporaryAliasList(toValue(mailbox), toValue(params)),
      queryFn: () => listTemporaryAliases(toValue(mailbox), toValue(params)),
      staleTime: 30_000,
      enabled: !!toValue(mailbox),
    })),
  )
}
export async function listTemporaryAliasDomains(mailbox: string) {
  return requireData(
    await api.GET('/mailboxes/{mailbox}/temporary-alias-domains', {
      params: { path: { mailbox }, query: { limit: 1000 } },
    }),
  ).data
}
export function useTemporaryAliasDomains(mailbox: MaybeRefOrGetter<string>) {
  return useQuery(
    computed(() => ({
      queryKey: queryKeys.selfService.temporaryAliasDomains(toValue(mailbox)),
      queryFn: () => listTemporaryAliasDomains(toValue(mailbox)),
      staleTime: 300_000,
      enabled: !!toValue(mailbox),
    })),
  )
}
export function afterTemporaryAliasChange(client: QueryClient, mailbox: string) {
  void client.invalidateQueries({ queryKey: queryKeys.selfService.temporaryAliases(mailbox) })
  void client.invalidateQueries({ queryKey: queryKeys.me.mailbox() })
  void client.invalidateQueries({ queryKey: queryKeys.mailboxes.detail(mailbox) })
  void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
}
export function createTemporaryAlias(
  client: QueryClient,
  mailbox: string,
  body: Pick<TemporaryAliasCreateRequest, 'domain'> &
    Partial<Omit<TemporaryAliasCreateRequest, 'domain'>>,
) {
  return runMutation(
    client,
    {
      mutationFn: async () =>
        requireData(
          await api.POST('/mailboxes/{mailbox}/temporary-aliases', {
            params: { path: { mailbox } },
            body: { description: '', lifetimeHours: 8760, permanent: false, ...body },
          }),
        ).data,
      onSuccess: () => afterTemporaryAliasChange(client, mailbox),
    },
    undefined,
  )
}
export function updateTemporaryAlias(
  client: QueryClient,
  mailbox: string,
  temporaryAlias: string,
  body: TemporaryAliasPatch,
  etag: string,
) {
  return runMutation(
    client,
    {
      mutationFn: async () =>
        requireData(
          await api.PATCH('/mailboxes/{mailbox}/temporary-aliases/{temporaryAlias}', {
            params: { path: { mailbox, temporaryAlias }, header: { 'If-Match': etag } },
            headers: { 'Content-Type': 'application/merge-patch+json' },
            body,
          }),
        ).data,
      onSuccess: () => afterTemporaryAliasChange(client, mailbox),
    },
    undefined,
  )
}
export function deleteTemporaryAlias(
  client: QueryClient,
  mailbox: string,
  temporaryAlias: string,
  etag: string,
) {
  return runMutation(
    client,
    {
      mutationFn: async () => {
        await api.DELETE('/mailboxes/{mailbox}/temporary-aliases/{temporaryAlias}', {
          params: { path: { mailbox, temporaryAlias }, header: { 'If-Match': etag } },
        })
      },
      onSuccess: () => afterTemporaryAliasChange(client, mailbox),
    },
    undefined,
  )
}
