import { queryOptions } from '@tanstack/vue-query'
import { api, queryKeys, requireData, type RspamdRegexMapListParams } from '@/api'
export function regexMapsOptions(params: RspamdRegexMapListParams) {
  return queryOptions({
    queryKey: queryKeys.rspamdRegexMaps.list(params),
    staleTime: 30_000,
    queryFn: async ({ signal }) =>
      requireData(
        await api.GET('/settings/rspamd-regex-maps', { params: { query: params }, signal }),
      ),
  })
}
export function regexMapOptions(mapId: string) {
  return queryOptions({
    queryKey: queryKeys.rspamdRegexMaps.detail(mapId),
    staleTime: 30_000,
    queryFn: async ({ signal }) =>
      requireData(
        await api.GET('/settings/rspamd-regex-maps/{mapId}', {
          params: { path: { mapId } },
          signal,
        }),
      ).data,
  })
}
export async function replaceRegexMap(mapId: string, content: string, etag: string) {
  const result = requireData(
    await api.PUT('/settings/rspamd-regex-maps/{mapId}', {
      params: { path: { mapId } },
      headers: { 'If-Match': etag },
      body: { content },
    }),
  ).data
  if (!('etag' in result)) throw new Error('Missing map after replacement')
  return result
}
export async function checkRegexMap(mapId: string, content: string, etag: string) {
  return requireData(
    await api.PUT('/settings/rspamd-regex-maps/{mapId}', {
      params: { path: { mapId }, query: { validateOnly: true } },
      headers: { 'If-Match': etag },
      body: { content },
    }),
  ).data
}
