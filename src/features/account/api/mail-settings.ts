import { useQuery, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import {
  api,
  queryKeys,
  requireData,
  runMutation,
  type MailboxMailSettings,
  type MailboxMailSettingsPatch,
} from '@/api'

export async function fetchMailSettings(mailbox: string): Promise<MailboxMailSettings> {
  return requireData(
    await api.GET('/mailboxes/{mailbox}/mail-settings', { params: { path: { mailbox } } }),
  ).data
}
export function useMailSettings(
  mailbox: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean> = true,
) {
  return useQuery(
    computed(() => ({
      queryKey: queryKeys.selfService.mailSettings(toValue(mailbox)),
      queryFn: () => fetchMailSettings(toValue(mailbox)),
      staleTime: 30_000,
      enabled: !!toValue(mailbox) && toValue(enabled),
    })),
  )
}
export function updateMailSettings(
  client: QueryClient,
  mailbox: string,
  body: MailboxMailSettingsPatch,
  etag: string,
): Promise<MailboxMailSettings> {
  return runMutation(
    client,
    {
      mutationFn: async () =>
        requireData(
          await api.PATCH('/mailboxes/{mailbox}/mail-settings', {
            params: { path: { mailbox }, header: { 'If-Match': etag } },
            headers: { 'Content-Type': 'application/merge-patch+json' },
            body,
          }),
        ).data,
      onSuccess: (value) => {
        client.setQueryData(queryKeys.selfService.mailSettings(mailbox), value)
        void client.invalidateQueries({ queryKey: queryKeys.mailboxes.all() })
        void client.invalidateQueries({ queryKey: queryKeys.me.mailbox() })
        void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
      },
    },
    undefined,
  )
}
