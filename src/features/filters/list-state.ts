import { computed } from 'vue'
import { componentsParametersSieveFilterSortValues, type SieveFilterListParams } from '@/api'
import {
  oneOf,
  text,
  useListState,
  type ListSchema,
  type ListState,
  type ListStateOptions,
} from '@/shared/composables/useListState'
import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'
export type FilterSort = NonNullable<SieveFilterListParams['sort']>
export interface FilterParams extends Record<string, unknown> {
  mailbox: string | undefined
  kind: 'prefilter' | 'postfilter' | undefined
  active: 'yes' | 'no' | undefined
  q: string | undefined
}
export const filterListSchema: ListSchema<FilterParams, FilterSort> = {
  filters: {
    mailbox: text({ maxLength: 254 }),
    kind: oneOf(['prefilter', 'postfilter']),
    active: oneOf(['yes', 'no']),
    q: text({ maxLength: SEARCH_MAX_LENGTH }),
  },
  sort: {
    values: componentsParametersSieveFilterSortValues,
    default: 'id',
    defaultOrder: (value) => (['id', 'createdAt', 'modifiedAt'].includes(value) ? 'desc' : 'asc'),
  },
}
export function filterListParams(
  state: ListState<FilterParams, FilterSort>,
): SieveFilterListParams {
  return {
    ...(state.filters.mailbox ? { mailbox: state.filters.mailbox } : {}),
    ...(state.filters.kind ? { kind: state.filters.kind } : {}),
    ...(state.filters.active ? { active: state.filters.active === 'yes' } : {}),
    ...(state.filters.q ? { q: state.filters.q } : {}),
    sort: state.sort ?? 'id',
    order: state.order ?? 'desc',
    limit: state.size,
    offset: (state.page - 1) * state.size,
  }
}
export function useFilterListState(options: ListStateOptions = {}) {
  const list = useListState(filterListSchema, options)
  return { ...list, params: computed(() => filterListParams(list.state.value)) }
}
