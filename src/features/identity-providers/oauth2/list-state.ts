// The OAuth2 list's address parameters (FR-054, docs/conventions.md "Lists"): the search over the
// client IDs and redirect URIs, the sort (ID, client ID, first redirect URI), the page and the page
// size. The token filter is not offered: the classic list has none (legacy form map). The
// selection of a bulk action resets through `onReset`.
import { computed } from 'vue'

import { componentsParametersOauth2ClientSortValues, type Oauth2ClientListParams } from '@/api'
import {
  text,
  useListState,
  type ListSchema,
  type ListState,
  type ListStateOptions,
} from '@/shared/composables/useListState'
import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'

export type Oauth2ClientSort = (typeof componentsParametersOauth2ClientSortValues)[number]

export interface Oauth2ListFilters extends Record<string, unknown> {
  q: string | undefined
}

export const oauth2ListSchema: ListSchema<Oauth2ListFilters, Oauth2ClientSort> = {
  filters: { q: text({ maxLength: SEARCH_MAX_LENGTH }) },
  sort: {
    values: componentsParametersOauth2ClientSortValues,
    default: 'id',
    defaultOrder: () => 'asc',
  },
}

/** The `listOauth2Clients` query of a list state; an empty search is left out. */
export function toOauth2ListParams(
  state: ListState<Oauth2ListFilters, Oauth2ClientSort>,
): Oauth2ClientListParams {
  return {
    limit: state.size,
    offset: (state.page - 1) * state.size,
    sort: state.sort ?? 'id',
    order: state.order ?? 'asc',
    ...(state.filters.q ? { q: state.filters.q } : {}),
  }
}

export function useOauth2ListState(options: ListStateOptions = {}) {
  const list = useListState(oauth2ListSchema, options)
  return {
    ...list,
    params: computed(() => toOauth2ListParams(list.state.value)),
    hasSearch: computed(() => !!list.state.value.filters.q),
  }
}
