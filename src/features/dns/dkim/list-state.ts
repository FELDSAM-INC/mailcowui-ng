// The DKIM list's address parameters (data-model §5, FR-005 to FR-012): search, the classic state
// toggles as a repeatable filter, kind, completeness, selector and domain (the domain with its alias
// domains, FR-012), sort, page and size. Domain administrators have no unused keys and no
// "No domain" kind, so those values are dropped from their address.
import { computed } from 'vue'

import {
  componentsParametersDkimKeySortValues,
  dkimKeyKindValues,
  dkimKeyStateValues,
  type DkimKeyKind,
  type DkimKeyState,
  type DkimListParams,
  type Role,
} from '@/api'
import {
  manyOf,
  oneOf,
  text,
  useListState,
  type ListSchema,
  type ListState,
  type ListStateOptions,
} from '@/shared/composables/useListState'
import {
  DKIM_DOMAIN_FILTER_MAX_LENGTH,
  DKIM_SELECTOR_FILTER_MAX_LENGTH,
  SEARCH_MAX_LENGTH,
} from '@/shared/validation/limits'

export type DkimSort = (typeof componentsParametersDkimKeySortValues)[number]

export interface DkimListFilters extends Record<string, unknown> {
  q: string | undefined
  state: DkimKeyState[]
  kind: DkimKeyKind | undefined
  complete: 'true' | 'false' | undefined
  selector: string | undefined
  domain: string | undefined
}

export type DkimListState = ListState<DkimListFilters, DkimSort>

/**
 * The states and kinds a role can filter by. The shell loads the identity before a page opens; an
 * unknown role keeps every value rather than dropping an administrator's filter.
 */
export function filterValues(role: Role | undefined) {
  const admin = role === undefined || role === 'admin'
  return {
    states: dkimKeyStateValues.filter((value) => admin || value !== 'unused'),
    kinds: dkimKeyKindValues.filter((value) => admin || value !== 'none'),
  }
}

export function dkimListSchema(role: Role | undefined): ListSchema<DkimListFilters, DkimSort> {
  const { states, kinds } = filterValues(role)
  return {
    filters: {
      q: text({ maxLength: SEARCH_MAX_LENGTH }),
      state: manyOf(states, { max: states.length }),
      kind: oneOf(kinds),
      complete: oneOf(['true', 'false'] as const),
      selector: text({ maxLength: DKIM_SELECTOR_FILTER_MAX_LENGTH }),
      domain: text({ maxLength: DKIM_DOMAIN_FILTER_MAX_LENGTH }),
    },
    sort: {
      values: componentsParametersDkimKeySortValues,
      default: 'name',
      defaultOrder: () => 'asc',
    },
  }
}

/** The `listDkimKeys` query of a list state; unset filters are left out. */
export function toDkimListParams(state: DkimListState): DkimListParams {
  const { filters, page, size } = state
  return {
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.state.length > 0 ? { state: [...filters.state] } : {}),
    ...(filters.kind ? { kind: filters.kind } : {}),
    ...(filters.complete ? { complete: filters.complete === 'true' } : {}),
    ...(filters.selector ? { selector: filters.selector } : {}),
    ...(filters.domain ? { domain: filters.domain } : {}),
    sort: state.sort ?? 'name',
    order: state.order ?? 'asc',
    limit: size,
    offset: (page - 1) * size,
  }
}

export function useDkimListState(role: Role | undefined, options: ListStateOptions = {}) {
  const list = useListState(dkimListSchema(role), options)
  return {
    ...list,
    params: computed(() => toDkimListParams(list.state.value)),
    /** Filters other than the search, each state counted once (FR-009). */
    activeFilterCount: computed(() => {
      const { state, kind, complete, selector, domain } = list.state.value.filters
      return (
        state.length + (kind ? 1 : 0) + (complete ? 1 : 0) + (selector ? 1 : 0) + (domain ? 1 : 0)
      )
    }),
    hasSearchOrFilters: computed(() => list.activeFilters.value.length > 0),
  }
}
