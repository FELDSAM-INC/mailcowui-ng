// The transport list's address parameters (data-model §5): search on destination, next hop and
// username; the active, MX-based and next hop filters; the sorts of `TransportSort`.
import { componentsParametersTransportSortValues, type TransportListParams } from '@/api'
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

export type TransportSort = (typeof componentsParametersTransportSortValues)[number]

export interface TransportFilters extends Record<string, unknown> {
  q: string | undefined
  active: BooleanParam
  mxBased: BooleanParam
  nextHop: string | undefined
}

export const transportListSchema: ListSchema<TransportFilters, TransportSort> = {
  filters: {
    q: searchParam(),
    active: booleanParam(),
    mxBased: booleanParam(),
    nextHop: searchParam(),
  },
  sort: {
    values: componentsParametersTransportSortValues,
    default: 'id',
    defaultOrder: () => 'asc',
  },
}

export function toTransportListParams(
  state: ListState<TransportFilters, TransportSort>,
): TransportListParams {
  return compact({
    ...pagingOf(state, 'id'),
    q: state.filters.q,
    active: toBoolean(state.filters.active),
    mxBased: toBoolean(state.filters.mxBased),
    nextHop: state.filters.nextHop,
  })
}

export const useTransportListState = (options: ListStateOptions = {}) =>
  useRoutingListState(transportListSchema, toTransportListParams, options)
