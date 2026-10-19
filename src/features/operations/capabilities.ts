// The monitoring capabilities (research R4, data-model §2): the polling interval, the freshness
// limits, the IP check switch, the caller's own address, the log retention and the limits come
// from `GET /capabilities/monitoring`, read once per visit (5 minutes fresh). Nothing they report
// is hard-coded: when the read fails, the screens load their data once, nothing polls, and the
// limits that depend on it are unavailable (no fallback constant).
import { queryOptions, useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'

import { api, requireData, type MonitoringCapabilities } from '@/api'
import { operationsKeys } from './query-keys'

/** The kinds of live data that poll. */
export type LiveKind = 'host' | 'containers' | 'resourceUsage' | 'mailStorage'

export const CAPABILITIES_STALE_MS = 5 * 60_000

export function monitoringCapabilitiesOptions() {
  return queryOptions({
    queryKey: operationsKeys.monitoring.capabilities(),
    queryFn: async (): Promise<MonitoringCapabilities> =>
      requireData(await api.GET('/capabilities/monitoring')).data,
    staleTime: CAPABILITIES_STALE_MS,
  })
}

/**
 * The refresh interval of a kind: the recommended polling interval, except the mail storage, which
 * is refreshed at its freshness limit (polling faster would refetch unchanged data, FR-018).
 */
export function intervalSeconds(capabilities: MonitoringCapabilities, kind: LiveKind): number {
  return kind === 'mailStorage'
    ? capabilities.maxAgeSeconds.mailStorage
    : capabilities.pollIntervalSeconds
}

export function useMonitoringCapabilities() {
  const query = useQuery(monitoringCapabilitiesOptions())
  const capabilities = computed(() => query.data.value ?? null)
  return {
    query,
    capabilities,
    /** True when the read failed (and no earlier read is cached). */
    unavailable: computed(() => query.isError.value && !query.data.value),
    /** The refresh interval of a kind in milliseconds; null without capabilities. */
    intervalMs(kind: LiveKind): number | null {
      const value = capabilities.value
      return value ? intervalSeconds(value, kind) * 1000 : null
    },
    retry: () => query.refetch(),
  }
}
