// The relayhost list's address parameters (data-model §5): search on host and username, the
// active and in-use filters, the sorts of `RelayhostSort` (default `id`), page and size.
import { componentsParametersRelayhostSortValues, type RelayhostListParams } from '@/api'
import type { ListSchema, ListState, ListStateOptions } from '@/shared/composables/useListState'

import {
  booleanParam,
  compact,
  pagingOf,
  searchParam,
  toBoolean,
  useRoutingListState,
  type BooleanParam,
} from './common'

export type RelayhostSort = (typeof componentsParametersRelayhostSortValues)[number]

export interface RelayhostFilters extends Record<string, unknown> {
  q: string | undefined
  active: BooleanParam
  inUse: BooleanParam
}

export const relayhostListSchema: ListSchema<RelayhostFilters, RelayhostSort> = {
  filters: { q: searchParam(), active: booleanParam(), inUse: booleanParam() },
  sort: {
    values: componentsParametersRelayhostSortValues,
    default: 'id',
    defaultOrder: () => 'asc',
  },
}

export function toRelayhostListParams(
  state: ListState<RelayhostFilters, RelayhostSort>,
): RelayhostListParams {
  return compact({
    ...pagingOf(state, 'id'),
    q: state.filters.q,
    active: toBoolean(state.filters.active),
    inUse: toBoolean(state.filters.inUse),
  })
}

export const useRelayhostListState = (options: ListStateOptions = {}) =>
  useRoutingListState(relayhostListSchema, toRelayhostListParams, options)
