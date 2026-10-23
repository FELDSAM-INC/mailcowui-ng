import {
  computed,
  inject,
  onScopeDispose,
  provide,
  ref,
  shallowRef,
  toValue,
  watch,
  watchEffect,
  type InjectionKey,
  type MaybeRefOrGetter,
  type ShallowRef,
} from 'vue'
import { localStore } from '@/shared/platform/storage'
import type { SortOrder } from './useListState'

export interface DataColumn {
  id: string
  label: string
  sort?: string
  defaultVisible?: boolean
}
export interface DataSorting {
  key: string | undefined
  order: SortOrder
  change: (key: string, order: SortOrder) => void
}
export interface DataRefresh {
  run: () => unknown
  pending: boolean
  disabled?: boolean
}
type Choices = Record<string, Record<string, boolean>>
const STORAGE = 'mailcowui-ng.table-columns'
function readChoices(): Choices {
  try {
    const value: unknown = JSON.parse(localStore.get(STORAGE) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const result: Choices = Object.create(null)
    for (const [list, choices] of Object.entries(value)) {
      if (
        !/^[a-z0-9-]+$/i.test(list) ||
        !choices ||
        typeof choices !== 'object' ||
        Array.isArray(choices)
      )
        continue
      result[list] = Object.fromEntries(
        Object.entries(choices).filter(
          (entry): entry is [string, boolean] =>
            /^[a-z0-9-]+$/i.test(entry[0]) && typeof entry[1] === 'boolean',
        ),
      )
    }
    return result
  } catch {
    return {}
  }
}

/** Presentation preferences contain static column identifiers only, never row/API data. */
export function createDataList(key: MaybeRefOrGetter<string>) {
  const columns = shallowRef<readonly DataColumn[]>([])
  const sorting = shallowRef<DataSorting>()
  const refresh = shallowRef<DataRefresh>()
  const choices = ref<Record<string, boolean>>(readChoices()[toValue(key)] ?? {})
  watch(
    () => toValue(key),
    (value) => {
      choices.value = readChoices()[value] ?? {}
    },
    { flush: 'sync' },
  )
  const visible = (id: string) => {
    const column = columns.value.find((item) => item.id === id)
    return !!column && (choices.value[id] ?? column.defaultVisible ?? true)
  }
  const visibleCount = computed(() => columns.value.filter((column) => visible(column.id)).length)
  function setVisible(id: string, value: boolean) {
    if (!columns.value.some((column) => column.id === id)) return
    if (!value && visible(id) && visibleCount.value <= 1) return
    choices.value = { ...choices.value, [id]: value }
    const listKey = toValue(key)
    if (listKey && /^[a-z0-9-]+$/i.test(listKey))
      localStore.set(STORAGE, JSON.stringify({ ...readChoices(), [listKey]: choices.value }))
  }
  function sort(id: string) {
    const current = sorting.value
    if (current) current.change(id, current.key === id && current.order === 'asc' ? 'desc' : 'asc')
  }
  return { columns, sorting, refresh, visible, visibleCount, setVisible, sort }
}
export type DataListContext = ReturnType<typeof createDataList>
export const dataListKey: InjectionKey<DataListContext> = Symbol('data-list')
export const listToolbarTarget: InjectionKey<{
  id: string
  element: ShallowRef<HTMLElement | null>
}> = Symbol('list-toolbar-filter-target')

/** One provider per independently paged list; nested lists use separate keys. */
export function useDataList(
  key: MaybeRefOrGetter<string>,
  sorting?: MaybeRefOrGetter<DataSorting>,
  refresh?: MaybeRefOrGetter<DataRefresh>,
) {
  const list = createDataList(key)
  if (sorting)
    watchEffect(() => {
      list.sorting.value = toValue(sorting)
    })
  if (refresh)
    watchEffect(() => {
      list.refresh.value = toValue(refresh)
    })
  provide(dataListKey, list)
  return list
}

/** The table owns its column definitions; the toolbar consumes the same registration. */
export function useDataColumns(
  columns: MaybeRefOrGetter<readonly DataColumn[]>,
  sorting?: MaybeRefOrGetter<DataSorting>,
  context?: DataListContext,
) {
  const list = context ?? inject(dataListKey, undefined) ?? createDataList('')
  provide(dataListKey, list)
  const stop = watch(
    () => toValue(columns),
    (value) => {
      list.columns.value = value
    },
    { immediate: true },
  )
  if (sorting)
    watchEffect(() => {
      list.sorting.value = toValue(sorting)
    })
  onScopeDispose(stop)
  return list
}
