// Tag suggestions from the distinct tags in the user's scope (UI 002 research D8, D13, FR-010,
// FR-039): `listDomainTags` with a 300 ms debounce, 25 suggestions sorted by name. No request is
// made until the user types or opens a tag field.
import { useQuery } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref } from 'vue'

import { SEARCH_MAX_LENGTH } from '@/shared/validation/limits'

import { tagsOptions } from '../api'

export const SUGGESTION_LIMIT = 25
export const SUGGESTION_DEBOUNCE_MS = 300

export function useTagSuggestions() {
  const term = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  /** Called on every keystroke; the request follows once typing pauses. */
  function search(value: string) {
    clearTimeout(timer)
    timer = setTimeout(() => {
      term.value = value.trim().slice(0, SEARCH_MAX_LENGTH)
    }, SUGGESTION_DEBOUNCE_MS)
  }

  onScopeDispose(() => clearTimeout(timer))

  const query = useQuery(
    computed(() => ({
      ...tagsOptions({ q: term.value ?? '', limit: SUGGESTION_LIMIT, sort: 'name' }),
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
