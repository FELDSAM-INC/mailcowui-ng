import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import { useDataColumns, useDataList, type DataColumn } from './useDataList'
import type { SortOrder } from './useListState'

export interface LocalDataColumn<T> extends DataColumn {
  value: (item: T) => string | number | boolean | null | undefined
}

/** Only for complete, unpaged collections. Server-paged lists always sort/search through the API. */
export function useLocalDataList<T>(
  key: string,
  items: MaybeRefOrGetter<readonly T[]>,
  columns: MaybeRefOrGetter<readonly LocalDataColumn<T>[]>,
) {
  const search = ref('')
  const sort = ref<string>()
  const order = ref<SortOrder>('asc')
  const list = useDataList(key, () => ({
    key: sort.value,
    order: order.value,
    change: (next, direction) => {
      sort.value = next
      order.value = direction
    },
  }))
  const table = useDataColumns(
    () => toValue(columns).map((column) => ({ ...column, sort: column.id })),
    undefined,
    list,
  )
  const rows = computed(() => {
    const definitions = toValue(columns)
    const query = search.value.trim().toLocaleLowerCase()
    const result = [...toValue(items)].filter(
      (item) =>
        !query ||
        definitions.some((column) =>
          String(column.value(item) ?? '')
            .toLocaleLowerCase()
            .includes(query),
        ),
    )
    const column = definitions.find((item) => item.id === sort.value)
    if (column)
      result.sort((a, b) => {
        const av = column.value(a),
          bv = column.value(b)
        const comparison =
          typeof av === 'number' && typeof bv === 'number'
            ? av - bv
            : String(av ?? '').localeCompare(String(bv ?? ''), undefined, {
                numeric: true,
                sensitivity: 'base',
              })
        return order.value === 'asc' ? comparison : -comparison
      })
    return result
  })
  return { search, rows, table }
}
