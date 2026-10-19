// The BCC map list's address parameters (data-model §5): search on both destinations; the type,
// active, repeated domain (at most 100) and orphaned filters (orphaned for administrators only);
// the sorts of `BccMapSort`.
import {
  bccMapTypeValues,
  componentsParametersBccMapSortValues,
  type BccMapListParams,
} from '@/api'
import {
  manyText,
  oneOf,
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

export type BccMapSort = (typeof componentsParametersBccMapSortValues)[number]
type BccType = (typeof bccMapTypeValues)[number]

export interface BccMapFilters extends Record<string, unknown> {
  q: string | undefined
  type: BccType | undefined
  active: BooleanParam
  domain: string[]
  orphaned: BooleanParam
}

export const bccMapListSchema: ListSchema<BccMapFilters, BccMapSort> = {
  filters: {
    q: searchParam(),
    type: oneOf(bccMapTypeValues),
    active: booleanParam(),
    domain: manyText({ max: 100, maxLength: SEARCH_MAX_LENGTH }),
    orphaned: booleanParam(),
  },
  sort: { values: componentsParametersBccMapSortValues, default: 'id', defaultOrder: () => 'asc' },
}

export function toBccMapListParams(
  state: ListState<BccMapFilters, BccMapSort>,
  admin: boolean,
): BccMapListParams {
  return compact({
    ...pagingOf(state, 'id'),
    q: state.filters.q,
    type: state.filters.type,
    active: toBoolean(state.filters.active),
    domain: state.filters.domain,
    orphaned: admin ? toBoolean(state.filters.orphaned) : undefined,
  })
}

export const useBccMapListState = (admin: () => boolean, options: ListStateOptions = {}) =>
  useRoutingListState(bccMapListSchema, (state) => toBccMapListParams(state, admin()), options)
