// Shared pieces of the routing list states (data-model §5 "Address parameters of the lists"):
// defaults are omitted from the address, invalid values fall back to them, and changing a filter,
// the sort or the page size returns to the first page and clears the selection (`onReset`).
import { computed } from 'vue'

import {
  oneOf,
  text,
  useListState,
  type ListSchema,
  type ListState,
  type ListStateOptions,
} from '@/shared/composables/useListState'
import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'

export const searchParam = () => text({ maxLength: SEARCH_MAX_LENGTH })
export const booleanParam = () => oneOf(['true', 'false'] as const)
export type BooleanParam = 'true' | 'false' | undefined

/** `true` / `false` as the API's boolean query value, or undefined when not set. */
export const toBoolean = (value: BooleanParam) =>
  value === undefined ? undefined : value === 'true'

/** Drops the members whose value is undefined or an empty list. */
export function compact<T extends Record<string, unknown>>(values: T): T {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0),
    ),
  ) as T
}

/** Paging and sort of a list state, as the API names them. */
export function pagingOf<F, S extends string>(state: ListState<F, S>, defaultSort: S) {
  return {
    limit: state.size,
    offset: (state.page - 1) * state.size,
    sort: state.sort ?? defaultSort,
    order: state.order ?? 'asc',
  }
}

/**
 * A routing list state: the schema's state in the address, the API parameters, and whether a
 * search or filter is set (for "no entries match").
 */
export function useRoutingListState<F extends Record<string, unknown>, S extends string, P>(
  schema: ListSchema<F, S>,
  toParams: (state: ListState<F, S>) => P,
  options: ListStateOptions = {},
) {
  const list = useListState(schema, options)
  return {
    ...list,
    params: computed(() => toParams(list.state.value)),
    hasFilters: computed(() => list.activeFilters.value.length > 0),
    clearFilters: () =>
      list.setFilters(
        Object.fromEntries(
          Object.keys(schema.filters).map((key) => [
            key,
            Array.isArray(list.state.value.filters[key]) ? [] : undefined,
          ]),
        ) as Partial<F>,
      ),
  }
}

export type RoutingListState = ReturnType<typeof useRoutingListState>
