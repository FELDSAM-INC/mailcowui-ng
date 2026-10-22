import { computed, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'

import { announce } from './useAnnouncer'
import type { ListQueryStateSource } from './useListQueryState'

interface FilteredListState {
  filters: Record<string, unknown>
  page: number
  size: number
}

/** Announce a changed filter's result count after real data arrives, without moving focus. */
export function useFilteredListAnnouncement(
  query: Pick<ListQueryStateSource, 'data' | 'isPlaceholderData'>,
  state: MaybeRefOrGetter<FilteredListState>,
) {
  const { locale } = useI18n()
  const filterKey = computed(() => JSON.stringify(toValue(state).filters))
  let announcedFor = filterKey.value
  const number = (value: number) => formatNumber(value, locale.value as AppLocale)

  // Watch the response, not the filters: the previous page's placeholder count must not be
  // announced. Initial loads, pagination, sorting and refreshes alone stay silent.
  watch(
    () => [query.data.value, query.isPlaceholderData.value] as const,
    ([data, placeholder]) => {
      if (!data || placeholder || filterKey.value === announcedFor) return
      announcedFor = filterKey.value
      const { page, size } = toValue(state)
      const from = data.meta.total === 0 ? 0 : (page - 1) * size + 1
      announce(
        data.meta.total === 0
          ? lt('datatables.infoEmpty')
          : lt('datatables.info', {
              _START_: number(from),
              _END_: number(Math.min(data.meta.total, page * size)),
              _TOTAL_: number(data.meta.total),
            }),
      )
    },
  )
}
