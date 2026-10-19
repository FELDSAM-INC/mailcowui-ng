// The address of the Rspamd scan history (FR-047; plan decision 18): the search, the sort (time,
// score, size or scan time; newest first by default), the page and the page size.
import { text, useListState } from '@/shared/composables/useListState'
import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'

export const RSPAMD_SORTS = ['time', 'score', 'size', 'scanTime'] as const
export type RspamdSort = (typeof RSPAMD_SORTS)[number]

export function useRspamdListState() {
  return useListState({
    filters: { q: text({ maxLength: SEARCH_MAX_LENGTH }) },
    sort: { values: RSPAMD_SORTS, default: 'time', defaultOrder: () => 'desc' as const },
  })
}
