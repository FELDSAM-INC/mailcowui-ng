import { computed } from 'vue'
import { componentsParametersRecentLoginSortValues, type RecentLoginListParams } from '@/api'
import {
  text,
  useListState,
  type ListSchema,
  type ListState,
} from '@/shared/composables/useListState'
import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'
import { recentLoginPeriods, type RecentLoginPeriodLimits } from './recent-login-period'

export type RecentLoginSort = NonNullable<RecentLoginListParams['sort']>
export interface RecentLoginFilters extends Record<string, unknown> {
  days: number
  service: string | undefined
  q: string | undefined
}
export function recentLoginListSchema(
  limits: RecentLoginPeriodLimits,
): ListSchema<RecentLoginFilters, RecentLoginSort> {
  const periods = recentLoginPeriods(limits)
  return {
    filters: {
      days: {
        parse: (raw) => {
          const value = Number(Array.isArray(raw) ? raw[0] : raw)
          return periods.includes(value) ? value : limits.defaultDays
        },
        serialize: (value) => (value === limits.defaultDays ? undefined : String(value)),
        isSet: (value) => value !== limits.defaultDays,
      },
      service: text({ maxLength: 32 }),
      q: text({ maxLength: SEARCH_MAX_LENGTH }),
    },
    sort: {
      values: componentsParametersRecentLoginSortValues,
      default: 'lastSeenAt',
      defaultOrder: (value) => (value === 'lastSeenAt' ? 'desc' : 'asc'),
    },
  }
}
export function recentLoginListParams(
  state: ListState<RecentLoginFilters, RecentLoginSort>,
): RecentLoginListParams {
  return {
    days: state.filters.days,
    ...(state.filters.service ? { service: state.filters.service } : {}),
    ...(state.filters.q ? { q: state.filters.q } : {}),
    sort: state.sort ?? 'lastSeenAt',
    order: state.order ?? 'desc',
    limit: state.size,
    offset: (state.page - 1) * state.size,
  }
}
export function useRecentLoginListState(limits: RecentLoginPeriodLimits) {
  const list = useListState(recentLoginListSchema(limits))
  return { ...list, params: computed(() => recentLoginListParams(list.state.value)) }
}
