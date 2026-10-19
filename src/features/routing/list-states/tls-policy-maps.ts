// The TLS policy map list's address parameters (data-model §5): search on destination and
// parameters, repeated `policy` (at most 8), the active filter and the sorts of `TlsPolicyMapSort`.
import {
  componentsParametersTlsPolicyMapSortValues,
  tlsPolicyValues,
  type TlsPolicyMapListParams,
} from '@/api'
import {
  manyOf,
  type ListSchema,
  type ListState,
  type ListStateOptions,
} from '@/shared/composables/useListState'

import {
  booleanParam,
  compact,
  pagingOf,
  searchParam,
  toBoolean,
  useRoutingListState,
  type BooleanParam,
} from './common'

export type TlsPolicyMapSort = (typeof componentsParametersTlsPolicyMapSortValues)[number]
type Policy = (typeof tlsPolicyValues)[number]

export interface TlsPolicyMapFilters extends Record<string, unknown> {
  q: string | undefined
  policy: Policy[]
  active: BooleanParam
}

export const tlsPolicyMapListSchema: ListSchema<TlsPolicyMapFilters, TlsPolicyMapSort> = {
  filters: {
    q: searchParam(),
    policy: manyOf(tlsPolicyValues, { max: 8 }),
    active: booleanParam(),
  },
  sort: {
    values: componentsParametersTlsPolicyMapSortValues,
    default: 'id',
    defaultOrder: () => 'asc',
  },
}

export function toTlsPolicyMapListParams(
  state: ListState<TlsPolicyMapFilters, TlsPolicyMapSort>,
): TlsPolicyMapListParams {
  return compact({
    ...pagingOf(state, 'id'),
    q: state.filters.q,
    policy: state.filters.policy,
    active: toBoolean(state.filters.active),
  })
}

export const useTlsPolicyMapListState = (options: ListStateOptions = {}) =>
  useRoutingListState(tlsPolicyMapListSchema, toTlsPolicyMapListParams, options)
