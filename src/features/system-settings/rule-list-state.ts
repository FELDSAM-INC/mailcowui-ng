import { computed } from 'vue'
import { componentsParametersRspamdSettingsRuleSortValues, type RspamdRuleListParams } from '@/api'
import {
  oneOf,
  text,
  useListState,
  type ListSchema,
  type ListState,
} from '@/shared/composables/useListState'
import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'
export type RuleSort = NonNullable<RspamdRuleListParams['sort']>
export interface RuleFilters extends Record<string, unknown> {
  q: string | undefined
  active: 'yes' | 'no' | undefined
}
export const ruleListSchema: ListSchema<RuleFilters, RuleSort> = {
  filters: { q: text({ maxLength: SEARCH_MAX_LENGTH }), active: oneOf(['yes', 'no']) },
  sort: {
    values: componentsParametersRspamdSettingsRuleSortValues,
    default: 'id',
    defaultOrder: () => 'asc',
  },
}
export function ruleListParams(state: ListState<RuleFilters, RuleSort>): RspamdRuleListParams {
  return {
    ...(state.filters.q ? { q: state.filters.q } : {}),
    ...(state.filters.active ? { active: state.filters.active === 'yes' } : {}),
    sort: state.sort ?? 'id',
    order: state.order ?? 'asc',
    limit: state.size,
    offset: (state.page - 1) * state.size,
  }
}
export function useRuleListState() {
  const list = useListState(ruleListSchema)
  return { ...list, params: computed(() => ruleListParams(list.state.value)) }
}
