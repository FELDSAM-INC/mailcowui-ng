// The Rate limits overview's address parameters (data-model §6, FR-056): the kind filter, the
// search on the object, sort by object (default) or kind, page and size.
import { computed } from 'vue'

import {
  componentsParametersRateLimitSortValues,
  rateLimitObjectKindValues,
  type RateLimitKind,
  type RateLimitListParams,
} from '@/api'
import {
  oneOf,
  text,
  useListState,
  type ListSchema,
  type ListState,
  type ListStateOptions,
} from '@/shared/composables/useListState'
import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'

export type RateLimitSort = (typeof componentsParametersRateLimitSortValues)[number]
export const RATE_LIMIT_KINDS = rateLimitObjectKindValues
export const RATE_LIMIT_SORTS = componentsParametersRateLimitSortValues

export interface RateLimitListFilters extends Record<string, unknown> {
  q: string | undefined
  kind: RateLimitKind | undefined
}

export type RateLimitListState = ListState<RateLimitListFilters, RateLimitSort>

export const rateLimitListSchema: ListSchema<RateLimitListFilters, RateLimitSort> = {
  filters: {
    q: text({ maxLength: SEARCH_MAX_LENGTH }),
    kind: oneOf(rateLimitObjectKindValues),
  },
  sort: {
    values: componentsParametersRateLimitSortValues,
    default: 'object',
    defaultOrder: () => 'asc',
  },
}

export function toRateLimitListParams(state: RateLimitListState): RateLimitListParams {
  const { filters, page, size } = state
  return {
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.kind ? { kind: filters.kind } : {}),
    sort: state.sort ?? 'object',
    order: state.order ?? 'asc',
    limit: size,
    offset: (page - 1) * size,
  }
}

export function useRateLimitListState(options: ListStateOptions = {}) {
  const list = useListState(rateLimitListSchema, options)
  return {
    ...list,
    params: computed(() => toRateLimitListParams(list.state.value)),
    hasSearchOrFilters: computed(() => list.activeFilters.value.length > 0),
  }
}
