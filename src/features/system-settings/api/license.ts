import { queryOptions } from '@tanstack/vue-query'
import { api, queryKeys, requireData } from '@/api'
export async function fetchLicense(signal?: AbortSignal) {
  return requireData(await api.GET('/license', { signal })).data
}
export function licenseOptions() {
  return queryOptions({
    queryKey: queryKeys.license(),
    queryFn: ({ signal }) => fetchLicense(signal),
    staleTime: 30_000,
  })
}
export async function verifyLicense() {
  return requireData(await api.POST('/license/verification')).data
}
