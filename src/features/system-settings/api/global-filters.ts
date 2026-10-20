import { queryOptions } from '@tanstack/vue-query'
import { api, queryKeys, requireData, type GlobalSieveFilter } from '@/api'

export function globalFiltersOptions() {
  return queryOptions({
    queryKey: queryKeys.globalSieveFilters(),
    staleTime: 30_000,
    queryFn: async ({ signal }) =>
      requireData(await api.GET('/settings/global-sieve-filters', { signal })).data,
  })
}

export async function checkGlobalFilter(filter: GlobalSieveFilter, script: string) {
  return requireData(
    await api.PUT('/settings/global-sieve-filters/{filterId}', {
      params: { path: { filterId: filter.id }, query: { validateOnly: true } },
      headers: { 'If-Match': filter.etag },
      body: { script, deferRestart: true },
    }),
  ).data
}

export async function replaceGlobalFilter(
  filter: GlobalSieveFilter,
  script: string,
  deferRestart: boolean,
) {
  const result = requireData(
    await api.PUT('/settings/global-sieve-filters/{filterId}', {
      params: { path: { filterId: filter.id } },
      headers: { 'If-Match': filter.etag },
      body: { script, deferRestart },
    }),
  )
  if (!('etag' in result.data) || !result.meta)
    throw new Error('Missing saved filter or restart outcome')
  return { filter: result.data, restart: result.meta.dovecotRestart }
}
