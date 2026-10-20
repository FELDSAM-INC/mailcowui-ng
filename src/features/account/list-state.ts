import { computed } from 'vue'
import { componentsParametersAppPasswordSortValues, type AppPasswordListParams } from '@/api'
import {
  oneOf,
  text,
  useListState,
  type ListSchema,
  type ListState,
  type ListStateOptions,
} from '@/shared/composables/useListState'
import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'
export type AppPasswordSort = NonNullable<AppPasswordListParams['sort']>
export interface AppPasswordFilters extends Record<string, unknown> {
  q: string | undefined
  active: 'yes' | 'no' | undefined
}
export const appPasswordListSchema: ListSchema<AppPasswordFilters, AppPasswordSort> = {
  filters: { q: text({ maxLength: SEARCH_MAX_LENGTH }), active: oneOf(['yes', 'no']) },
  sort: {
    values: componentsParametersAppPasswordSortValues,
    default: 'name',
    defaultOrder: (sort) => (sort === 'createdAt' || sort === 'modifiedAt' ? 'desc' : 'asc'),
  },
}
export function appPasswordListParams(
  state: ListState<AppPasswordFilters, AppPasswordSort>,
): AppPasswordListParams {
  return {
    ...(state.filters.q ? { q: state.filters.q } : {}),
    ...(state.filters.active ? { active: state.filters.active === 'yes' } : {}),
    sort: state.sort ?? 'name',
    order: state.order ?? 'asc',
    limit: state.size,
    offset: (state.page - 1) * state.size,
  }
}
export function useAppPasswordListState(options: ListStateOptions = {}) {
  const list = useListState(appPasswordListSchema, options)
  return { ...list, params: computed(() => appPasswordListParams(list.state.value)) }
}
