// The template list's address parameters (UI 002 data-model §5, FR-049): the name search, the
// sort (name, ID, creation and modification time), the page and the page size. The selection of a
// multiple deletion resets through `onReset`.
import { computed } from 'vue'

import { componentsParametersDomainTemplateSortValues, type TemplateListParams } from '@/api'
import {
  text,
  useListState,
  type ListSchema,
  type ListState,
  type ListStateOptions,
} from '@/shared/composables/useListState'
import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'

export type TemplateSort = (typeof componentsParametersDomainTemplateSortValues)[number]

export interface TemplateListFilters extends Record<string, unknown> {
  q: string | undefined
}

export const templateListSchema: ListSchema<TemplateListFilters, TemplateSort> = {
  filters: { q: text({ maxLength: SEARCH_MAX_LENGTH }) },
  sort: {
    values: componentsParametersDomainTemplateSortValues,
    default: 'name',
    defaultOrder: () => 'asc',
  },
}

/** The `listDomainTemplates` query of a list state; an empty search is left out. */
export function toTemplateListParams(
  state: ListState<TemplateListFilters, TemplateSort>,
): TemplateListParams {
  return {
    limit: state.size,
    offset: (state.page - 1) * state.size,
    sort: state.sort ?? 'name',
    order: state.order ?? 'asc',
    ...(state.filters.q ? { q: state.filters.q } : {}),
  }
}

export function useTemplateListState(options: ListStateOptions = {}) {
  const list = useListState(templateListSchema, options)
  return {
    ...list,
    params: computed(() => toTemplateListParams(list.state.value)),
    hasSearch: computed(() => !!list.state.value.filters.q),
  }
}
