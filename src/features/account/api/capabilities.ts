// The self-service capabilities (UI 005 data-model §3, research R4): server settings and limits,
// read signed out on the sign-in screens (only `passwordReset`) and signed in everywhere else. The
// cache is cleared at every sign-in and sign-out (001-R9), so the two answers never mix.
import { queryOptions, useQuery } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import { api, queryKeys, requireData, type SelfServiceCapabilities } from '@/api'

export async function fetchSelfServiceCapabilities(): Promise<SelfServiceCapabilities> {
  return requireData(await api.GET('/capabilities/self-service')).data
}

export function selfServiceCapabilitiesOptions() {
  return queryOptions({
    queryKey: queryKeys.capabilities.selfService(),
    queryFn: fetchSelfServiceCapabilities,
    staleTime: 300_000,
  })
}

export function useSelfServiceCapabilities(enabled: MaybeRefOrGetter<boolean> = true) {
  return useQuery({
    ...selfServiceCapabilitiesOptions(),
    enabled: computed(() => toValue(enabled)),
  })
}
