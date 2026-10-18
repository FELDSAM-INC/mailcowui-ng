// The audit log query (data-model §3). The key holds the address state, with a preset kept as its
// token, so that resolving "the last 24 hours" to a start time when the query runs never changes
// the key. Nothing refetches by itself (FR-033).
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import { api, queryKeys, requireData } from '@/api'
import type { ListState } from '@/shared/composables/useListState'

import { toAuditParams, type AuditFilterValues } from './list-state'

export async function fetchAuditEvents(state: ListState<AuditFilterValues, never>) {
  const query = toAuditParams(state)
  return requireData(await api.GET('/audit-events', { params: { query } }))
}

export function useAuditEvents(state: MaybeRefOrGetter<ListState<AuditFilterValues, never>>) {
  const key = computed(() => {
    const current = toValue(state)
    // The preset token instead of the resolved start: stable while the address is unchanged.
    const {
      from: _from,
      to: _to,
      ...params
    } = toAuditParams({
      ...current,
      filters: { ...current.filters, range: undefined },
    })
    return [
      ...queryKeys.auditEvents.list(params),
      { range: current.filters.range, from: current.filters.from, to: current.filters.to },
    ] as const
  })
  return useQuery({
    queryKey: key,
    queryFn: () => fetchAuditEvents(toValue(state)),
    placeholderData: keepPreviousData,
  })
}
