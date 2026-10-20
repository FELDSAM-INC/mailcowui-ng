// Readable metadata may be cached. Creating or renewing a password returns directly to
// useSecretRequest; generatedPassword is removed before any metadata reaches a query cache.
import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import {
  api,
  queryKeys,
  requireData,
  runMutation,
  type AppPassword,
  type AppPasswordCreateRequest,
  type AppPasswordListParams,
  type AppPasswordPatch,
  type AppPasswordResult,
  type ListMeta,
} from '@/api'

export interface AppPasswordPage {
  data: AppPassword[]
  meta: ListMeta
}
export async function listAppPasswords(
  mailbox: string,
  params: AppPasswordListParams,
): Promise<AppPasswordPage> {
  return requireData(
    await api.GET('/mailboxes/{mailbox}/app-passwords', {
      params: { path: { mailbox }, query: params },
    }),
  )
}
export function useAppPasswords(
  mailbox: MaybeRefOrGetter<string>,
  params: MaybeRefOrGetter<AppPasswordListParams>,
  enabled: MaybeRefOrGetter<boolean> = true,
) {
  return useQuery(
    computed(() => ({
      queryKey: queryKeys.selfService.appPasswordList(toValue(mailbox), toValue(params)),
      queryFn: () => listAppPasswords(toValue(mailbox), toValue(params)),
      staleTime: 30_000,
      enabled: !!toValue(mailbox) && toValue(enabled),
    })),
  )
}
export async function fetchAppPassword(mailbox: string, id: number): Promise<AppPassword> {
  return requireData(
    await api.GET('/mailboxes/{mailbox}/app-passwords/{appPasswordId}', {
      params: { path: { mailbox, appPasswordId: id } },
    }),
  ).data
}
export function useAppPassword(mailbox: MaybeRefOrGetter<string>, id: MaybeRefOrGetter<number>) {
  const client = useQueryClient()
  return useQuery(
    computed(() =>
      queryOptions({
        queryKey: queryKeys.selfService.appPassword(toValue(mailbox), toValue(id)),
        queryFn: () => fetchAppPassword(toValue(mailbox), toValue(id)),
        staleTime: 30_000,
        enabled: !!toValue(mailbox) && Number.isSafeInteger(toValue(id)),
        initialData: () => {
          for (const [key, value] of client.getQueriesData<AppPasswordPage>({
            queryKey: queryKeys.selfService.appPasswords(toValue(mailbox)),
          })) {
            if (key[3] === 'list') {
              const item = value?.data?.find((item) => item.id === toValue(id))
              if (item) return item
            }
          }
          return undefined
        },
      }),
    ),
  )
}
export function withoutSecret(value: AppPasswordResult | AppPassword): AppPassword {
  const { id, mailbox, name, protocols, active, createdAt, modifiedAt, etag } = value
  return { id, mailbox, name, protocols: [...protocols], active, createdAt, modifiedAt, etag }
}
export function afterAppPasswordChange(
  client: QueryClient,
  value: AppPasswordResult | AppPassword,
) {
  const metadata = withoutSecret(value)
  client.setQueryData(queryKeys.selfService.appPassword(value.mailbox, value.id), metadata)
  void client.invalidateQueries({
    queryKey: [...queryKeys.selfService.appPasswords(value.mailbox), 'list'],
  })
  void client.invalidateQueries({ queryKey: queryKeys.me.mailbox() })
  void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
}
/** Secret-bearing result: invoke with useSecretRequest, never runMutation. */
export async function createAppPassword(
  mailbox: string,
  body: Omit<AppPasswordCreateRequest, 'password'>,
): Promise<AppPasswordResult> {
  return requireData(
    await api.POST('/mailboxes/{mailbox}/app-passwords', { params: { path: { mailbox } }, body }),
  ).data
}
/** Secret-bearing result: invoke with useSecretRequest, never runMutation. */
export async function regenerateAppPassword(
  mailbox: string,
  id: number,
  etag: string,
): Promise<AppPasswordResult> {
  return requireData(
    await api.PATCH('/mailboxes/{mailbox}/app-passwords/{appPasswordId}', {
      params: { path: { mailbox, appPasswordId: id }, header: { 'If-Match': etag } },
      headers: { 'Content-Type': 'application/merge-patch+json' },
      body: { generatePassword: true },
    }),
  ).data
}
export function updateAppPassword(
  client: QueryClient,
  mailbox: string,
  id: number,
  body: Omit<AppPasswordPatch, 'password' | 'generatePassword'>,
  etag: string,
): Promise<AppPassword> {
  return runMutation(
    client,
    {
      mutationFn: async () =>
        withoutSecret(
          requireData(
            await api.PATCH('/mailboxes/{mailbox}/app-passwords/{appPasswordId}', {
              params: { path: { mailbox, appPasswordId: id }, header: { 'If-Match': etag } },
              headers: { 'Content-Type': 'application/merge-patch+json' },
              body,
            }),
          ).data,
        ),
      onSuccess: (value) => {
        afterAppPasswordChange(client, value)
      },
    },
    undefined,
  )
}
export function deleteAppPassword(
  client: QueryClient,
  mailbox: string,
  id: number,
  etag: string,
): Promise<void> {
  return runMutation(
    client,
    {
      mutationFn: async () => {
        await api.DELETE('/mailboxes/{mailbox}/app-passwords/{appPasswordId}', {
          params: { path: { mailbox, appPasswordId: id }, header: { 'If-Match': etag } },
        })
      },
      onSuccess: () => {
        client.removeQueries({ queryKey: queryKeys.selfService.appPassword(mailbox, id) })
        void client.invalidateQueries({ queryKey: queryKeys.selfService.appPasswords(mailbox) })
        void client.invalidateQueries({ queryKey: queryKeys.me.mailbox() })
        void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
      },
    },
    undefined,
  )
}
