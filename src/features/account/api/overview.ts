// The own mailbox overview (UI 005 data-model §3, research R20): mailbox users with a full session,
// fresh for five minutes (it changes through this screen's own mutations, which invalidate it).
import { queryOptions, useQuery } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import { api, queryKeys, requireData, type MailboxOverview } from '@/api'

export async function fetchOwnMailboxOverview(): Promise<MailboxOverview> {
  return requireData(await api.GET('/me/mailbox')).data
}

export function ownMailboxOverviewOptions() {
  return queryOptions({
    queryKey: queryKeys.me.mailbox(),
    queryFn: fetchOwnMailboxOverview,
    staleTime: 300_000,
  })
}

export function useOwnMailboxOverview(enabled: MaybeRefOrGetter<boolean> = true) {
  return useQuery({ ...ownMailboxOverviewOptions(), enabled: computed(() => toValue(enabled)) })
}
