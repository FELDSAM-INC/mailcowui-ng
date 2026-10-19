// The capabilities of aliases, alias domains, resources and sender settings (research R5, FR-071):
// read once and kept for 5 minutes. Forms and bulk bars wait for them (CapabilitiesGate); lists and
// detail views never do.
import { queryOptions, useQuery } from '@tanstack/vue-query'

import { api, queryKeys, requireData, type AliasCapabilities } from '@/api'

export async function fetchAliasesCapabilities(): Promise<AliasCapabilities> {
  return requireData(await api.GET('/capabilities/aliases')).data
}

export function aliasesCapabilitiesOptions() {
  return queryOptions({
    queryKey: queryKeys.capabilities.aliases(),
    queryFn: fetchAliasesCapabilities,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  })
}

export function useAliasesCapabilities() {
  return useQuery(aliasesCapabilitiesOptions())
}
