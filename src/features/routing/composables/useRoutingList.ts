// The wiring every routing list shares (research R4, R5; FR-005 to FR-010, FR-015, FR-016, FR-069):
// the list state in the address, the query with the previous page kept while the next loads, the
// four list states, the result count announced after a search or filter change, the routing
// capabilities (bulk limit, page sizes), the selection of the current page and the bulk actions.
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/vue-query'
import { computed, watch, type Component, type ComputedRef } from 'vue'

import type { BulkResult, BulkTarget } from '@/api'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import type { BulkRow } from '@/shared/components/bulk-row'
import { announce } from '@/shared/composables/useAnnouncer'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import type { ListStateOptions, PageSize, SortOrder } from '@/shared/composables/useListState'
import { useI18n } from 'vue-i18n'

import type { Page } from '../api/common'
import { useRoutingCapabilities } from '../capabilities'
import type { AnyBulkAction, BulkCollection } from '../logic/bulk-actions'
import { useRoutingBulk } from './useRoutingBulk'

/** What a routing list needs of its list state. */
export interface ListControls {
  state: ComputedRef<{
    filters: Record<string, unknown>
    sort: string | undefined
    order: SortOrder | undefined
    page: number
    size: PageSize
  }>
  hasFilters: ComputedRef<boolean>
  setFilter(key: string, value: unknown, options?: { typing?: boolean }): Promise<void>
  setSort(sort: string, order?: SortOrder): Promise<void>
  setPage(page: number): Promise<void>
  setSize(size: PageSize): Promise<void>
  clearFilters(): Promise<void>
}

export interface RoutingListSpec<T, P> {
  collection: BulkCollection
  /** Creates the list state; `onReset` clears the selection. */
  state: (options: ListStateOptions) => ListControls & { params: ComputedRef<P> }
  queryKey: (params: P) => QueryKey
  fetch: (params: P) => Promise<Page<T>>
  idOf: (entry: T) => string
  nameOf: (entry: T) => string
  targetOf: (entry: T) => BulkTarget
  sendBulk: (
    client: QueryClient,
    action: AnyBulkAction,
    targets: BulkTarget[],
  ) => Promise<BulkResult>
  bulkMessage?: (row: BulkRow, entry: T | undefined, action: AnyBulkAction) => string | null
  deleteImpact?: (entries: readonly T[]) => {
    component: Component
    props?: Record<string, unknown>
  }
  /** False while the list must not load (for example before the identity is known). */
  enabled?: () => boolean
}

export function useRoutingList<T, P>(spec: RoutingListSpec<T, P>) {
  const client = useQueryClient()
  const { locale } = useI18n()
  const capabilities = useRoutingCapabilities()
  const selection = useBulkSelection({ limit: () => capabilities.bulkLimit.value })
  const list = spec.state({ onReset: () => selection.clear() })

  const query = useQuery(
    computed(() => ({
      queryKey: spec.queryKey(list.params.value),
      queryFn: () => spec.fetch(list.params.value),
      staleTime: 30_000,
      placeholderData: keepPreviousData,
      enabled: spec.enabled?.() ?? true,
    })),
  )
  const entries = computed<T[]>(() => query.data.value?.data ?? [])
  const total = computed(() => query.data.value?.meta.total ?? 0)

  const initialLoading = computed(() => query.isPending.value)
  const loadFailed = computed(() => query.isError.value && !query.data.value)
  const refreshFailed = computed(() => query.isError.value && !!query.data.value)
  const empty = computed(
    () => !!query.data.value && !query.isPlaceholderData.value && total.value === 0,
  )
  const noMatches = computed(() => empty.value && list.hasFilters.value)
  const listState = computed(() =>
    initialLoading.value ? 'loading' : loadFailed.value ? 'error' : empty.value ? 'empty' : 'ready',
  )

  /** Legacy's DataTables summary ("Showing 1 to 25 of 60 entries"), announced after a filter change. */
  const summary = computed(() => {
    const number = (value: number) => formatNumber(value, locale.value as AppLocale)
    if (total.value === 0) return lt('datatables.infoEmpty')
    const { page, size } = list.state.value
    return lt('datatables.info', {
      _START_: number((page - 1) * size + 1),
      _END_: number(Math.min(total.value, page * size)),
      _TOTAL_: number(total.value),
    })
  })
  let announcedFor = JSON.stringify(list.state.value.filters)
  watch(
    () => [query.data.value, query.isPlaceholderData.value] as const,
    ([data, placeholder]) => {
      const filters = JSON.stringify(list.state.value.filters)
      if (!data || placeholder || filters === announcedFor) return
      announcedFor = filters
      announce(summary.value)
    },
  )

  const bulk = useRoutingBulk<T>({
    collection: spec.collection,
    selection,
    entries: () => entries.value,
    idOf: spec.idOf,
    nameOf: spec.nameOf,
    targetOf: spec.targetOf,
    send: (action, targets) => spec.sendBulk(client, action, targets),
    refetch: () => query.refetch(),
    message: spec.bulkMessage,
    deleteImpact: spec.deleteImpact,
  })

  return {
    list,
    query,
    entries,
    total,
    capabilities,
    selection,
    bulk,
    initialLoading,
    loadFailed,
    refreshFailed,
    empty,
    noMatches,
    listState,
    summary,
    idOf: spec.idOf,
    nameOf: spec.nameOf,
    refresh: () => query.refetch(),
  }
}

export type RoutingList<T> = ReturnType<typeof useRoutingList<T, unknown>>
