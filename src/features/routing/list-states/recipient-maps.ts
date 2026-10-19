// The recipient map list's address parameters (data-model §5): search on both destinations, the
// active filter and the sorts of `RecipientMapSort`.
import { componentsParametersRecipientMapSortValues, type RecipientMapListParams } from '@/api'
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

export type RecipientMapSort = (typeof componentsParametersRecipientMapSortValues)[number]

export interface RecipientMapFilters extends Record<string, unknown> {
  q: string | undefined
  active: BooleanParam
}

export const recipientMapListSchema: ListSchema<RecipientMapFilters, RecipientMapSort> = {
  filters: { q: searchParam(), active: booleanParam() },
  sort: {
    values: componentsParametersRecipientMapSortValues,
    default: 'id',
    defaultOrder: () => 'asc',
  },
}

export function toRecipientMapListParams(
  state: ListState<RecipientMapFilters, RecipientMapSort>,
): RecipientMapListParams {
  return compact({
    ...pagingOf(state, 'id'),
    q: state.filters.q,
    active: toBoolean(state.filters.active),
  })
}

export const useRecipientMapListState = (options: ListStateOptions = {}) =>
  useRoutingListState(recipientMapListSchema, toRecipientMapListParams, options)
