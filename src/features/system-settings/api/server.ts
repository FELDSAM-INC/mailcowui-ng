import { queryOptions, useQuery } from '@tanstack/vue-query'

import { api, queryKeys, requireData, type IpCheckSettingPatch } from '@/api'

export async function fetchIpCheck(signal?: AbortSignal) {
  return requireData(await api.GET('/settings/ip-check', { signal })).data
}
export function ipCheckOptions() {
  return queryOptions({
    queryKey: queryKeys.systemSettings.ipCheck(),
    queryFn: ({ signal }) => fetchIpCheck(signal),
    staleTime: 30_000,
  })
}
export const useIpCheck = () => useQuery(ipCheckOptions())

export async function updateIpCheck(body: IpCheckSettingPatch, ifMatch: string) {
  return requireData(
    await api.PATCH('/settings/ip-check', {
      headers: { 'Content-Type': 'application/merge-patch+json', 'If-Match': ifMatch },
      body,
    }),
  ).data
}
