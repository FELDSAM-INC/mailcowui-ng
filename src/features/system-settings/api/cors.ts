import { queryOptions, useQuery } from '@tanstack/vue-query'
import { api, queryKeys, requireData, type LegacyApiCorsSettingsPatch } from '@/api'
export async function fetchCors(signal?: AbortSignal) {
  return requireData(await api.GET('/settings/legacy-api-cors', { signal })).data
}
export function corsOptions() {
  return queryOptions({
    queryKey: queryKeys.legacyApiCors(),
    queryFn: ({ signal }) => fetchCors(signal),
    staleTime: 30_000,
  })
}
export const useCors = () => useQuery(corsOptions())
export async function updateCors(body: LegacyApiCorsSettingsPatch, ifMatch: string) {
  return requireData(
    await api.PATCH('/settings/legacy-api-cors', {
      headers: { 'Content-Type': 'application/merge-patch+json', 'If-Match': ifMatch },
      body,
    }),
  ).data
}
