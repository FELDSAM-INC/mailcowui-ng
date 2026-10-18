// Tag suggestions from the tags in use in the caller's scope (FR-038, `listMailboxTags`): 300 ms
// after typing, 25 sorted by name. No request is made until the user types in a tag field.
import { useQuery } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref } from 'vue'

import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'

import { tagsOptions } from '../api'

const LIMIT = 25
const DEBOUNCE_MS = 300

export function useMailboxTagSuggestions() {
  const term = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  function search(value: string) {
    clearTimeout(timer)
    timer = setTimeout(() => {
      term.value = value.trim().slice(0, SEARCH_MAX_LENGTH)
    }, DEBOUNCE_MS)
  }

  onScopeDispose(() => clearTimeout(timer))

  const query = useQuery(
    computed(() => ({
      ...tagsOptions({ q: term.value ?? '', limit: LIMIT, sort: 'name' }),
      enabled: term.value !== null,
    })),
  )

  return {
    search,
    suggestions: computed(() => query.data.value?.data.map((tag) => tag.name) ?? []),
    state: computed<'idle' | 'loading' | 'error'>(() =>
      query.isError.value ? 'error' : query.isFetching.value ? 'loading' : 'idle',
    ),
  }
}
