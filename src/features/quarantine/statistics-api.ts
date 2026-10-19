// The spam filter's action statistics (UI 006 US8, data-model §3, FR-065). The key root is the
// spam policy's, but the quarantine area owns the query, because it never imports the spam filter
// area (research R4). Nothing refetches on a timer: the page's Refresh does.
import { queryOptions, useQuery } from '@tanstack/vue-query'

import { api, queryKeys, requireData, type SpamFilterActionStatistics } from '@/api'

export async function fetchSpamStatistics(): Promise<SpamFilterActionStatistics> {
  return requireData(await api.GET('/spam-filter-action-statistics')).data
}

export function spamStatisticsOptions() {
  return queryOptions({
    queryKey: queryKeys.spamPolicy.statistics(),
    queryFn: fetchSpamStatistics,
    staleTime: 30_000,
  })
}

export function useSpamStatistics() {
  return useQuery(spamStatisticsOptions())
}
