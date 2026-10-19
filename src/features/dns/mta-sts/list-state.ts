// The MTA-STS policy list's address parameters (data-model §5, FR-054): search on the domain,
// active state, mode, sort, page and size.
import { computed } from 'vue'

import {
  componentsParametersMtaStsPolicySortValues,
  mtaStsModeValues,
  type MtaStsListParams,
  type MtaStsMode,
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

export type MtaStsSort = (typeof componentsParametersMtaStsPolicySortValues)[number]

export interface MtaStsListFilters extends Record<string, unknown> {
  q: string | undefined
  active: 'true' | 'false' | undefined
  mode: MtaStsMode | undefined
}

export type MtaStsListState = ListState<MtaStsListFilters, MtaStsSort>

export const mtaStsListSchema: ListSchema<MtaStsListFilters, MtaStsSort> = {
  filters: {
    q: text({ maxLength: SEARCH_MAX_LENGTH }),
    active: oneOf(['true', 'false'] as const),
    mode: oneOf(mtaStsModeValues),
  },
  sort: {
    values: componentsParametersMtaStsPolicySortValues,
    default: 'domain',
    defaultOrder: () => 'asc',
  },
}

export function toMtaStsListParams(state: MtaStsListState): MtaStsListParams {
  const { filters, page, size } = state
  return {
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.active ? { active: filters.active === 'true' } : {}),
    ...(filters.mode ? { mode: filters.mode } : {}),
    sort: state.sort ?? 'domain',
    order: state.order ?? 'asc',
    limit: size,
    offset: (page - 1) * size,
  }
}

export function useMtaStsListState(options: ListStateOptions = {}) {
  const list = useListState(mtaStsListSchema, options)
  return {
    ...list,
    params: computed(() => toMtaStsListParams(list.state.value)),
    activeFilterCount: computed(() => {
      const { active, mode } = list.state.value.filters
      return (active ? 1 : 0) + (mode ? 1 : 0)
    }),
    hasSearchOrFilters: computed(() => list.activeFilters.value.length > 0),
  }
}
