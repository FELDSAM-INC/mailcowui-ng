// The resource list's address parameters (data-model §5, FR-043): search, the domain, kind and
// active filters, sort, page and size live in the address with the contract's query names;
// defaults are left out.
import { computed } from 'vue'

import {
  componentsParametersResourceSortValues,
  resourceKindValues,
  type ResourceListParams,
} from '@/api'
import {
  manyOf,
  manyText,
  oneOf,
  text,
  useListState,
  type ListSchema,
  type ListState,
  type ListStateOptions,
} from '@/shared/composables/useListState'
import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'

export type ResourceSort = (typeof componentsParametersResourceSortValues)[number]
type Flag = 'true' | 'false' | undefined

export interface ResourceListFilters extends Record<string, unknown> {
  q: string | undefined
  domain: string[]
  kind: (typeof resourceKindValues)[number][]
  active: Flag
}

export type ResourceListState = ListState<ResourceListFilters, ResourceSort>

export const resourceListSchema: ListSchema<ResourceListFilters, ResourceSort> = {
  filters: {
    q: text({ maxLength: SEARCH_MAX_LENGTH }),
    domain: manyText({ max: 100, maxLength: 253 }),
    kind: manyOf(resourceKindValues, { max: resourceKindValues.length }),
    active: oneOf(['true', 'false'] as const),
  },
  sort: {
    values: componentsParametersResourceSortValues,
    default: 'description',
    defaultOrder: () => 'asc',
  },
}

export function toResourceParams(state: ResourceListState): ResourceListParams {
  const { filters, page, size } = state
  const params: ResourceListParams = {
    limit: size,
    offset: (page - 1) * size,
    sort: state.sort ?? 'description',
    order: state.order ?? 'asc',
  }
  if (filters.q) params.q = filters.q
  if (filters.domain.length > 0) params.domain = [...filters.domain]
  if (filters.kind.length > 0) params.kind = [...filters.kind]
  if (filters.active !== undefined) params.active = filters.active === 'true'
  return params
}

export function useResourceListState(options: ListStateOptions = {}) {
  const list = useListState(resourceListSchema, options)
  return {
    ...list,
    hasSearchOrFilters: computed(() => list.activeFilters.value.length > 0),
  }
}
