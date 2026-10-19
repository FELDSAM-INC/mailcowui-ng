// The routing capabilities (research R3): the bulk limit, page sizes, field limits, the connection
// test's defaults and timeouts and the TLS policies come from the server, never from constants.
// Read once per visit of the Routing section and kept for five minutes.
import { queryOptions, useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'

import { api, queryKeys, requireData, type RoutingCapabilities } from '@/api'
import { PAGE_SIZES, type PageSize } from '@/shared/composables/useListState'

export const CAPABILITIES_STALE_TIME = 5 * 60_000

export async function fetchRoutingCapabilities(): Promise<RoutingCapabilities> {
  return requireData(await api.GET('/capabilities/routing')).data
}

export function routingCapabilitiesOptions() {
  return queryOptions({
    queryKey: queryKeys.routingCapabilities(),
    queryFn: fetchRoutingCapabilities,
    staleTime: CAPABILITIES_STALE_TIME,
  })
}

/** The page sizes 25, 50 and 100 that the server's maximum allows. */
export function pageSizeOptions(capabilities: RoutingCapabilities | undefined): PageSize[] {
  const maximum = capabilities?.pageSize.maximum ?? Infinity
  return PAGE_SIZES.filter((size) => size <= maximum)
}

export function useRoutingCapabilities() {
  const query = useQuery(routingCapabilitiesOptions())
  return {
    ...query,
    pageSizes: computed(() => pageSizeOptions(query.data.value)),
    bulkLimit: computed(() => query.data.value?.bulkLimit ?? null),
    administration: computed(() => query.data.value?.administration ?? null),
  }
}
