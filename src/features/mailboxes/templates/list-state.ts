// The mailbox template list's address parameters (UI 003 US7, data-model §5): the name search, the
// sort (name, ID, creation and modification time), the page and the page size. The selection of a
// mass removal resets through `onReset`.
import { computed } from 'vue'

import {
  componentsParametersMailboxTemplateSortValues,
  type MailboxTemplateListParams,
} from '@/api'
import {
  text,
  useListState,
  type ListSchema,
  type ListState,
  type ListStateOptions,
} from '@/shared/composables/useListState'
import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'

export type TemplateSort = (typeof componentsParametersMailboxTemplateSortValues)[number]

export interface TemplateListFilters extends Record<string, unknown> {
  q: string | undefined
}

export const templateListSchema: ListSchema<TemplateListFilters, TemplateSort> = {
  filters: { q: text({ maxLength: SEARCH_MAX_LENGTH }) },
  sort: {
    values: componentsParametersMailboxTemplateSortValues,
    default: 'name',
    defaultOrder: () => 'asc',
  },
}

/** The `listMailboxTemplates` query of a list state; an empty search is left out. */
export function toTemplateListParams(
  state: ListState<TemplateListFilters, TemplateSort>,
): MailboxTemplateListParams {
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
