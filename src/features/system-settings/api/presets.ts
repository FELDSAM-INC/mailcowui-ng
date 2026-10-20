import { queryOptions } from '@tanstack/vue-query'
import { api, queryKeys, requireData, type Preset } from '@/api'
export async function fetchPresets(kind: 'rspamd' | 'sieve'): Promise<Preset[]> {
  const result: Preset[] = []
  for (let offset = 0; ;) {
    const page = requireData(
      await api.GET('/presets/{presetKind}', {
        params: {
          path: { presetKind: kind },
          query: { limit: 100, offset, sort: 'id', order: 'asc' },
        },
      }),
    )
    result.push(...page.data)
    offset += page.data.length
    if (!page.data.length || offset >= page.meta.total) return result
  }
}
export function presetsOptions(kind: 'rspamd' | 'sieve') {
  return queryOptions({
    queryKey: queryKeys.presets(kind),
    queryFn: () => fetchPresets(kind),
    staleTime: 300_000,
  })
}
