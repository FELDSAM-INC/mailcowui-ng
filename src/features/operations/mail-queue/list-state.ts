// The mail queue's address (data-model §5, FR-050, plan decision 18): legacy's search, the sort of
// its columns, the page and the page size. Oldest first by default, as the API lists the queue.
import { computed } from 'vue'

import type { MailQueueListParams } from '@/api'
import {
  text,
  useListState,
  type ListSchema,
  type ListState,
  type ListStateOptions,
} from '@/shared/composables/useListState'
import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'

export const MAIL_QUEUE_SORTS = ['arrivalTime', 'size', 'sender', 'queue', 'id'] as const
export type MailQueueSort = (typeof MAIL_QUEUE_SORTS)[number]

export interface MailQueueFilters extends Record<string, unknown> {
  q: string | undefined
}

export const mailQueueListSchema: ListSchema<MailQueueFilters, MailQueueSort> = {
  filters: { q: text({ maxLength: SEARCH_MAX_LENGTH }) },
  sort: { values: MAIL_QUEUE_SORTS, default: 'arrivalTime', defaultOrder: () => 'asc' },
}

/** The request parameters of a list state. */
export function queueParams(
  state: ListState<MailQueueFilters, MailQueueSort>,
): MailQueueListParams {
  return {
    ...(state.filters.q ? { q: state.filters.q } : {}),
    sort: state.sort ?? 'arrivalTime',
    order: state.order ?? 'asc',
    limit: state.size,
    offset: (state.page - 1) * state.size,
  }
}

export function useMailQueueListState(options: ListStateOptions = {}) {
  const list = useListState(mailQueueListSchema, options)
  return {
    ...list,
    params: computed(() => queueParams(list.state.value)),
  }
}
