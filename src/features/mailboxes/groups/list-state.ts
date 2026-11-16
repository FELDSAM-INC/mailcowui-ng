import { computed } from 'vue'
import { text, useListState } from '@/shared/composables/useListState'
import type { GroupListParams } from './api'

export const groupSorts = ['name', 'domain', 'address', 'active', 'priority', 'id'] as const
export function useGroupListState() {
  const list = useListState({
    filters: { q: text({ maxLength: 255 }) },
    sort: { values: groupSorts, default: 'name', defaultOrder: () => 'asc' },
  })
  return {
    ...list,
    params: computed<GroupListParams>(() => ({
      q: list.state.value.filters.q || undefined,
      sort: list.state.value.sort ?? 'name',
      order: list.state.value.order ?? 'asc',
      limit: list.state.value.size,
      offset: (list.state.value.page - 1) * list.state.value.size,
    })),
  }
}
