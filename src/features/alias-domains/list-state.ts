// The domain alias list's address parameters (data-model §5, FR-034): search, the target and
// active filters, sort, page and size live in the address with the contract's query names;
// defaults are left out.
import { computed } from 'vue'

import { componentsParametersAliasDomainSortValues, type AliasDomainListParams } from '@/api'
import {
  manyText,
  oneOf,
  text,
  useListState,
  type ListSchema,
  type ListState,
  type ListStateOptions,
} from '@/shared/composables/useListState'
import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'

export type AliasDomainSort = (typeof componentsParametersAliasDomainSortValues)[number]
type Flag = 'true' | 'false' | undefined

export interface AliasDomainListFilters extends Record<string, unknown> {
  q: string | undefined
  targetDomain: string[]
  active: Flag
}

export type AliasDomainListState = ListState<AliasDomainListFilters, AliasDomainSort>

export const aliasDomainListSchema: ListSchema<AliasDomainListFilters, AliasDomainSort> = {
  filters: {
    q: text({ maxLength: SEARCH_MAX_LENGTH }),
    targetDomain: manyText({ max: 100, maxLength: 253 }),
    active: oneOf(['true', 'false'] as const),
  },
  sort: {
    values: componentsParametersAliasDomainSortValues,
    default: 'name',
    defaultOrder: () => 'asc',
  },
}

/** The `listAliasDomains` query of a list state; unset filters are left out. */
export function toAliasDomainParams(state: AliasDomainListState): AliasDomainListParams {
  const { filters, page, size } = state
  const sort = state.sort ?? 'name'
  const order = state.order ?? 'asc'
  const params: AliasDomainListParams = { limit: size, offset: (page - 1) * size, sort, order }
  if (filters.q) params.q = filters.q
  if (filters.targetDomain.length > 0) params.targetDomain = [...filters.targetDomain]
  if (filters.active !== undefined) params.active = filters.active === 'true'
  return params
}

export function useAliasDomainListState(options: ListStateOptions = {}) {
  const list = useListState(aliasDomainListSchema, options)
  return {
    ...list,
    hasSearchOrFilters: computed(() => list.activeFilters.value.length > 0),
  }
}
