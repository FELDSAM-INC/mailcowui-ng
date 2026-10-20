import { useQuery, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import {
  api,
  queryKeys,
  requireData,
  runMutation,
  type PushNotificationSettings,
  type PushNotificationSettingsReplacement,
  type Writable,
} from '@/api'

export async function fetchPushSettings(mailbox: string) {
  return requireData(
    await api.GET('/mailboxes/{mailbox}/push-notifications', {
      params: { path: { mailbox } },
    }),
  ).data
}
export function usePushSettings(mailbox: MaybeRefOrGetter<string>) {
  return useQuery(
    computed(() => ({
      queryKey: queryKeys.selfService.pushNotifications(toValue(mailbox)),
      queryFn: () => fetchPushSettings(toValue(mailbox)),
      staleTime: 30_000,
      enabled: !!toValue(mailbox),
    })),
  )
}
export function afterPushSettingsChange(
  client: QueryClient,
  mailbox: string,
  value?: PushNotificationSettings,
) {
  if (value) client.setQueryData(queryKeys.selfService.pushNotifications(mailbox), value)
  else void client.invalidateQueries({ queryKey: queryKeys.selfService.pushNotifications(mailbox) })
  void client.invalidateQueries({ queryKey: queryKeys.me.mailbox() })
  void client.invalidateQueries({ queryKey: queryKeys.mailboxes.detail(mailbox) })
  void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
}
/** Carries credentials. Invoke through useSecretRequest, never a mutation cache. */
export async function replacePushSettings(
  mailbox: string,
  body: Writable<PushNotificationSettingsReplacement>,
  etag: string,
) {
  return requireData(
    await api.PUT('/mailboxes/{mailbox}/push-notifications', {
      params: { path: { mailbox }, header: { 'If-Match': etag } },
      body,
    }),
  ).data
}
export function verifyPushSettings(client: QueryClient, mailbox: string) {
  return runMutation(
    client,
    {
      mutationFn: async () =>
        requireData(
          await api.POST('/mailboxes/{mailbox}/push-notifications/verification', {
            params: { path: { mailbox } },
          }),
        ).data,
    },
    undefined,
  )
}
export function deletePushSettings(client: QueryClient, mailbox: string, etag: string) {
  return runMutation(
    client,
    {
      mutationFn: async () => {
        await api.DELETE('/mailboxes/{mailbox}/push-notifications', {
          params: { path: { mailbox }, header: { 'If-Match': etag } },
        })
      },
      onSuccess: () => afterPushSettingsChange(client, mailbox),
    },
    undefined,
  )
}
