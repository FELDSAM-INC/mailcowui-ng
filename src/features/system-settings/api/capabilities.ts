// UI 013 R8: server limits and visibility are cached together; no guessed fallback values.
import { queryOptions, useQuery } from '@tanstack/vue-query'

import { api, queryKeys, requireData, type SettingsCapabilities } from '@/api'

export async function fetchSettingsCapabilities(
  signal?: AbortSignal,
): Promise<SettingsCapabilities> {
  return requireData(await api.GET('/capabilities/settings', { signal })).data
}

export function settingsCapabilitiesOptions() {
  return queryOptions({
    queryKey: queryKeys.systemSettings.capabilities(),
    queryFn: ({ signal }) => fetchSettingsCapabilities(signal),
    staleTime: 5 * 60_000,
  })
}

export function useSettingsCapabilities() {
  return useQuery(settingsCapabilitiesOptions())
}
