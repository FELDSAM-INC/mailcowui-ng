// The address of a log (FR-037; plan decisions 11 and 18): the search (`q`) and the order of the
// time column (`order`, newest first by default). Changing either starts again from the first page.
import { text, useListState } from '@/shared/composables/useListState'
import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'

export function useLogListState() {
  return useListState({
    filters: { q: text({ maxLength: SEARCH_MAX_LENGTH }) },
    sort: { values: ['time'] as const, default: 'time', defaultOrder: () => 'desc' as const },
  })
}
