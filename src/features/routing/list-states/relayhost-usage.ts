// The relayhost usage view's address parameters (data-model §5): kind, search on the name, the
// sorts `kind` (default) and `name`, page and size.
import {
  componentsParametersRelayhostUsageSortValues,
  relayhostUsageEntryKindValues,
  type RelayhostUsageParams,
} from '@/api'
import {
  oneOf,
  type ListSchema,
  type ListState,
  type ListStateOptions,
} from '@/shared/composables/useListState'

import { compact, pagingOf, searchParam, useRoutingListState } from './common'

export type RelayhostUsageSort = (typeof componentsParametersRelayhostUsageSortValues)[number]
type Kind = (typeof relayhostUsageEntryKindValues)[number]

export interface RelayhostUsageFilters extends Record<string, unknown> {
  q: string | undefined
  kind: Kind | undefined
}

export const relayhostUsageSchema: ListSchema<RelayhostUsageFilters, RelayhostUsageSort> = {
  filters: { q: searchParam(), kind: oneOf(relayhostUsageEntryKindValues) },
  sort: {
    values: componentsParametersRelayhostUsageSortValues,
    default: 'kind',
    defaultOrder: () => 'asc',
  },
}

export function toRelayhostUsageParams(
  state: ListState<RelayhostUsageFilters, RelayhostUsageSort>,
): RelayhostUsageParams {
  return compact({ ...pagingOf(state, 'kind'), q: state.filters.q, kind: state.filters.kind })
}

export const useRelayhostUsageState = (options: ListStateOptions = {}) =>
  useRoutingListState(relayhostUsageSchema, toRelayhostUsageParams, options)
