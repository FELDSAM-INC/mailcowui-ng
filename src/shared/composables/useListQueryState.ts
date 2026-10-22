import { computed, toValue, type MaybeRefOrGetter, type Ref } from 'vue'

import type { ListMeta } from '@/api'

/** Only the query fields needed to present a list; fetching remains with the feature. */
export interface ListQueryStateSource {
  data: Readonly<Ref<{ meta: Pick<ListMeta, 'total'> } | undefined>>
  isPending: Readonly<Ref<boolean>>
  isError: Readonly<Ref<boolean>>
  isPlaceholderData: Readonly<Ref<boolean>>
}

export function useListQueryState(
  query: ListQueryStateSource,
  hasSearchOrFilters: MaybeRefOrGetter<boolean>,
) {
  const total = computed(() => query.data.value?.meta.total ?? 0)
  const initialLoading = computed(() => query.isPending.value)
  const loadFailed = computed(() => query.isError.value && !query.data.value)
  const refreshFailed = computed(() => query.isError.value && !!query.data.value)
  const empty = computed(
    () => !!query.data.value && !query.isPlaceholderData.value && total.value === 0,
  )
  const noMatches = computed(() => empty.value && toValue(hasSearchOrFilters))
  const listState = computed(() =>
    initialLoading.value ? 'loading' : loadFailed.value ? 'error' : empty.value ? 'empty' : 'ready',
  )

  return { total, initialLoading, loadFailed, refreshFailed, empty, noMatches, listState }
}
