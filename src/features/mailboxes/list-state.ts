// The mailbox list's address parameters (UI 003 data-model §5, FR-006, FR-009, FR-010): search,
// domains, statuses, tags and authentication sources, sort, page and size live in the address and
// map to `listMailboxes`; defaults are left out and invalid values dropped. Changes return to the
// first page and call `onReset` (the bulk selection).
import { computed } from 'vue'

import {
  componentsParametersMailboxSortValues,
  mailboxAuthSourceValues,
  mailboxStatusValues,
  type MailboxAuthSource,
  type MailboxListParams,
  type MailboxStatus,
} from '@/api'
import {
  manyOf,
  manyText,
  text,
  useListState,
  type ListSchema,
  type ListState,
  type ListStateOptions,
} from '@/shared/composables/useListState'
import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'

import type { MailboxSort } from './labels'

/** At most this many values of one repeatable filter (data-model §5). */
export const FILTER_MAX_VALUES = 100

export interface MailboxListFilters extends Record<string, unknown> {
  q: string | undefined
  domain: string[]
  status: MailboxStatus[]
  tag: string[]
  source: MailboxAuthSource[]
}

export const NO_FILTERS: MailboxListFilters = {
  q: undefined,
  domain: [],
  status: [],
  tag: [],
  source: [],
}

export const mailboxListSchema: ListSchema<MailboxListFilters, MailboxSort> = {
  filters: {
    q: text({ maxLength: SEARCH_MAX_LENGTH }),
    domain: manyText({ max: FILTER_MAX_VALUES, maxLength: 255 }),
    status: manyOf(mailboxStatusValues, { max: FILTER_MAX_VALUES }),
    tag: manyText({ max: FILTER_MAX_VALUES, maxLength: 255 }),
    source: manyOf(mailboxAuthSourceValues, { max: FILTER_MAX_VALUES }),
  },
  sort: {
    values: componentsParametersMailboxSortValues,
    default: 'address',
    defaultOrder: () => 'asc',
  },
}

/** The `listMailboxes` query of a list state; unset filters are left out. */
export function toListParams(state: ListState<MailboxListFilters, MailboxSort>): MailboxListParams {
  const { filters, page, size } = state
  return {
    limit: size,
    offset: (page - 1) * size,
    sort: state.sort ?? 'address',
    order: state.order ?? 'asc',
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.domain.length > 0 ? { domain: [...filters.domain] } : {}),
    ...(filters.status.length > 0 ? { status: [...filters.status] } : {}),
    ...(filters.tag.length > 0 ? { tag: [...filters.tag] } : {}),
    ...(filters.source.length > 0 ? { authSource: [...filters.source] } : {}),
  }
}

export function useMailboxListState(options: ListStateOptions = {}) {
  const list = useListState(mailboxListSchema, options)
  return {
    ...list,
    params: computed(() => toListParams(list.state.value)),
    /** Filters other than the search, each value counted once. */
    activeFilterCount: computed(() => {
      const { domain, status, tag, source } = list.state.value.filters
      return domain.length + status.length + tag.length + source.length
    }),
    /** The search or any filter is set. */
    hasSearchOrFilters: computed(() => list.activeFilters.value.length > 0),
  }
}
