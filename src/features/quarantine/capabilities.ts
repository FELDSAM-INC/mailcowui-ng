// The quarantine capabilities (UI 006 research R8): every limit the quarantine, spam policy and
// rate limit forms and lists need (bulk limit, page sizes, content limit, score range, pattern
// rules, rate limit range and frames, settings limits). Read once per session and never
// hard-coded (conventions "Where features meet"): one query, fresh for ten minutes, shared by every
// consumer without a second request.
import { queryOptions, useQuery } from '@tanstack/vue-query'

import { api, queryKeys, requireData, type QuarantineCapabilities } from '@/api'

export const CAPABILITIES_STALE_TIME = 600_000

export async function fetchQuarantineCapabilities(): Promise<QuarantineCapabilities> {
  return requireData(await api.GET('/capabilities/quarantine')).data
}

export function quarantineCapabilitiesOptions() {
  return queryOptions({
    queryKey: queryKeys.quarantine.capabilities(),
    queryFn: fetchQuarantineCapabilities,
    staleTime: CAPABILITIES_STALE_TIME,
  })
}

/** The capabilities, with the query's loading and error states and `refetch` for a retry. */
export function useQuarantineCapabilities() {
  return useQuery(quarantineCapabilitiesOptions())
}
