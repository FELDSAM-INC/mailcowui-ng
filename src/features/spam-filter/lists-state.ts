// The address of the lists panel (UI 006 research R19, data-model §6 "Lists panel"): the Allowlist
// and the Denylist each keep their search, sort, page and page size under their own prefix
// (`allowQ`, `blockPage`, …) through two `useListState` instances, and the list shown below `md` is
// the `list` parameter (default `allow`), read and written directly on the address with every other
// key kept (the host page's `edit`, the other list's keys).
//
// One table per list (legacy form map D16) shows the own entries first, then the inherited ones,
// under one paging: a page asks for its slice of the own entries and for the inherited entries that
// follow the last own entry, so own entries come first across pages.
import { computed, watch } from 'vue'
import { useRoute, useRouter, type LocationQuery } from 'vue-router'

import type { SpamPolicyEntryListParams, SpamPolicyList } from '@/api'
import {
  text,
  useListState,
  type ListSchema,
  type ListState,
  type ListStateOptions,
} from '@/shared/composables/useListState'
import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'

export const POLICY_LISTS = ['allow', 'block'] as const satisfies readonly SpamPolicyList[]
export type PolicySort = 'pattern' | 'createdAt'
export const POLICY_SORTS = ['pattern', 'createdAt'] as const satisfies readonly PolicySort[]

export interface PolicyListFilters extends Record<string, unknown> {
  q: string | undefined
}

export type PolicyListState = ListState<PolicyListFilters, PolicySort>

export const policyListSchema: ListSchema<PolicyListFilters, PolicySort> = {
  filters: { q: text({ maxLength: SEARCH_MAX_LENGTH }) },
  sort: {
    values: POLICY_SORTS,
    default: 'pattern',
    defaultOrder: (sort) => (sort === 'createdAt' ? 'desc' : 'asc'),
  },
}

/** The state of one list, under its prefix. */
export function usePolicyListState(
  list: SpamPolicyList,
  options: Omit<ListStateOptions, 'prefix'> = {},
) {
  return useListState(policyListSchema, { ...options, prefix: list })
}

const LIST_KEY = 'list'

function parseList(raw: LocationQuery[string] | undefined): SpamPolicyList | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  return value === 'allow' || value === 'block' ? value : null
}

/** The list shown below `md`: `list` in the address, `allow` when absent. */
export function useListSwitch() {
  const route = useRoute()
  const router = useRouter()
  const list = computed<SpamPolicyList>(() => parseList(route.query[LIST_KEY]) ?? 'allow')

  function location(next: SpamPolicyList) {
    const query: LocationQuery = { ...route.query }
    delete query[LIST_KEY]
    if (next !== 'allow') query[LIST_KEY] = next
    return { query, hash: route.hash }
  }

  // An invalid value, or the default written out, is removed without a history entry.
  watch(
    () => route.query[LIST_KEY],
    (raw) => {
      if (raw === undefined || parseList(raw) === 'block') return
      void router.replace(location(parseList(raw) ?? 'allow'))
    },
    { immediate: true },
  )

  return {
    list,
    setList(next: SpamPolicyList) {
      return router.replace(location(next))
    },
  }
}

/**
 * The requests of a page: the own entries of the page and, once their total is known, the inherited
 * entries that follow the last own entry (the caller shows as many as fit the page).
 */
export function pageRequests(
  list: SpamPolicyList,
  state: PolicyListState,
  ownTotal: number | undefined,
): { own: SpamPolicyEntryListParams; inherited: SpamPolicyEntryListParams | null } {
  const start = (state.page - 1) * state.size
  const common = {
    list,
    ...(state.filters.q ? { q: state.filters.q } : {}),
    sort: state.sort ?? 'pattern',
    order: state.order ?? 'asc',
    limit: state.size,
  }
  return {
    own: { ...common, ownership: 'own', offset: start },
    inherited:
      ownTotal === undefined
        ? null
        : { ...common, ownership: 'inherited', offset: Math.max(0, start - ownTotal) },
  }
}
