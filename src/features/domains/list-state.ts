// The domain list's address parameters (UI 002 research D8, data-model §5, FR-005 to FR-012).
// Search, filters, sort, page and size live in the address; the selection resets through
// `onReset` (research D22).
import { computed } from 'vue'

import { componentsParametersDomainSortValues, type DomainListParams } from '@/api'
import {
  custom,
  oneOf,
  text,
  useListState,
  type ListSchema,
  type ListState,
  type ListStateOptions,
  type ParamSpec,
} from '@/shared/composables/useListState'
import {
  DOMAIN_TAG_FILTER_MAX_ITEMS,
  DOMAIN_TAG_MAX_LENGTH,
  SEARCH_MAX_LENGTH,
} from '@/shared/validation/limits'

export type DomainSort = (typeof componentsParametersDomainSortValues)[number]

export interface DomainListFilters extends Record<string, unknown> {
  q: string | undefined
  active: 'active' | 'inactive' | undefined
  relay: 'relay' | 'local' | undefined
  tag: string[]
}

/** Repeatable whole tags: trimmed, 1–255 characters, once ignoring case, at most 100. */
export function tagList(options: { max: number; maxLength: number }): ParamSpec<string[]> {
  return custom({
    parse(raw) {
      const values = (Array.isArray(raw) ? raw : [raw]).filter(
        (value): value is string => typeof value === 'string',
      )
      const seen = new Set<string>()
      const tags: string[] = []
      for (const value of values) {
        const tag = value.trim()
        if (tag.length === 0 || tag.length > options.maxLength) return []
        if (seen.has(tag.toLowerCase())) continue
        seen.add(tag.toLowerCase())
        tags.push(tag)
      }
      return tags.length <= options.max ? tags : []
    },
    serialize: (value) => (value.length > 0 ? [...value] : undefined),
    isSet: (value) => value.length > 0,
  })
}

export const domainListSchema: ListSchema<DomainListFilters, DomainSort> = {
  filters: {
    q: text({ maxLength: SEARCH_MAX_LENGTH }),
    active: oneOf(['active', 'inactive'] as const),
    relay: oneOf(['relay', 'local'] as const),
    tag: tagList({ max: DOMAIN_TAG_FILTER_MAX_ITEMS, maxLength: DOMAIN_TAG_MAX_LENGTH }),
  },
  sort: {
    values: componentsParametersDomainSortValues,
    default: 'name',
    defaultOrder: () => 'asc',
  },
}

/** The `listDomains` query of a list state; unset filters are left out. */
export function toListParams(state: ListState<DomainListFilters, DomainSort>): DomainListParams {
  const { filters, page, size } = state
  return {
    limit: size,
    offset: (page - 1) * size,
    sort: state.sort ?? 'name',
    order: state.order ?? 'asc',
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.active ? { active: filters.active === 'active' } : {}),
    ...(filters.relay ? { backupMx: filters.relay === 'relay' } : {}),
    ...(filters.tag.length > 0 ? { tag: [...filters.tag] } : {}),
  }
}

export function useDomainListState(options: ListStateOptions = {}) {
  const list = useListState(domainListSchema, options)
  return {
    ...list,
    params: computed(() => toListParams(list.state.value)),
    /** Filters other than the search, each tag counted once (FR-010). */
    activeFilterCount: computed(() => {
      const { active, relay, tag } = list.state.value.filters
      return (active ? 1 : 0) + (relay ? 1 : 0) + tag.length
    }),
    /** The search or any filter is set. */
    hasSearchOrFilters: computed(() => list.activeFilters.value.length > 0),
  }
}
