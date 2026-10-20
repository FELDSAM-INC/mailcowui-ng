import { useQuery, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { api, queryKeys, requireData, runMutation, type RecentLoginListParams } from '@/api'

export function useRecentLogins(
  mailbox: MaybeRefOrGetter<string>,
  params: MaybeRefOrGetter<RecentLoginListParams>,
) {
  return useQuery(
    computed(() => ({
      queryKey: queryKeys.selfService.recentLoginList(toValue(mailbox), toValue(params)),
      queryFn: async () =>
        requireData(
          await api.GET('/mailboxes/{mailbox}/recent-logins', {
            params: { path: { mailbox: toValue(mailbox) }, query: toValue(params) },
          }),
        ),
      staleTime: 30_000,
      enabled: !!toValue(mailbox),
    })),
  )
}
export function clearRecentLogins(client: QueryClient, mailbox: string): Promise<void> {
  return runMutation(
    client,
    {
      mutationFn: async () => {
        await api.DELETE('/mailboxes/{mailbox}/recent-logins', { params: { path: { mailbox } } })
      },
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: queryKeys.selfService.recentLogins(mailbox) })
        void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
      },
    },
    undefined,
  )
}
