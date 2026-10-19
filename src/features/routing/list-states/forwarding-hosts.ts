// The forwarding host list's address parameters (data-model §5): search on address and source, the
// spam filter and exact source filters, and the sorts of `ForwardingHostSort` (default `address`).
import { componentsParametersForwardingHostSortValues, type ForwardingHostListParams } from '@/api'
import {
  custom,
  type ListSchema,
  type ListState,
  type ListStateOptions,
} from '@/shared/composables/useListState'
import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'

import {
  booleanParam,
  compact,
  pagingOf,
  searchParam,
  toBoolean,
  useRoutingListState,
  type BooleanParam,
} from './common'

export type ForwardingHostSort = (typeof componentsParametersForwardingHostSortValues)[number]

export interface ForwardingHostFilters extends Record<string, unknown> {
  q: string | undefined
  spamFilter: BooleanParam
  /** Exact, so an empty source is a value too; absent means "not set". */
  source: string | undefined
}

const sourceParam = custom<string | undefined>({
  parse(raw) {
    const value = Array.isArray(raw) ? raw[0] : raw
    return typeof value === 'string' && value.length <= SEARCH_MAX_LENGTH ? value : undefined
  },
  serialize: (value) => value,
  isSet: (value) => value !== undefined,
})

export const forwardingHostListSchema: ListSchema<ForwardingHostFilters, ForwardingHostSort> = {
  filters: { q: searchParam(), spamFilter: booleanParam(), source: sourceParam },
  sort: {
    values: componentsParametersForwardingHostSortValues,
    default: 'address',
    defaultOrder: () => 'asc',
  },
}

export function toForwardingHostListParams(
  state: ListState<ForwardingHostFilters, ForwardingHostSort>,
): ForwardingHostListParams {
  return compact({
    ...pagingOf(state, 'address'),
    q: state.filters.q,
    spamFilter: toBoolean(state.filters.spamFilter),
    source: state.filters.source,
  })
}

export const useForwardingHostListState = (options: ListStateOptions = {}) =>
  useRoutingListState(forwardingHostListSchema, toForwardingHostListParams, options)
