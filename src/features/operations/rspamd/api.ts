// Rspamd's statistics and scan history (research R13, data-model §3): the statistics once per visit
// (refreshed by hand), the history page by page from the address. Neither refreshes on its own.
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import {
  api,
  requireData,
  type ListMeta,
  type RspamdHistoryEntry,
  type RspamdHistoryParams,
  type RspamdStatistics,
} from '@/api'
import { operationsKeys } from '../query-keys'

export interface RspamdHistoryPage {
  data: RspamdHistoryEntry[]
  meta: ListMeta
}

export function useRspamdStatistics() {
  return useQuery({
    queryKey: operationsKeys.rspamd.statistics(),
    queryFn: async (): Promise<RspamdStatistics> =>
      requireData(await api.GET('/rspamd/statistics')).data,
    staleTime: Infinity,
    retry: false,
  })
}

export function useRspamdHistory(params: MaybeRefOrGetter<RspamdHistoryParams>) {
  return useQuery(
    computed(() => {
      const query = toValue(params)
      return {
        queryKey: operationsKeys.rspamd.history(query),
        queryFn: async (): Promise<RspamdHistoryPage> =>
          requireData(await api.GET('/rspamd/history', { params: { query } })),
        staleTime: 30_000,
        retry: false,
        placeholderData: keepPreviousData,
      }
    }),
  )
}
