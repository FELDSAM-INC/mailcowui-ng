import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { useListQueryState } from '@/shared/composables/useListQueryState'

function setup() {
  const query = {
    data: ref<{ meta: { total: number } }>(),
    isPending: ref(true),
    isError: ref(false),
    isPlaceholderData: ref(false),
  }
  const filtered = ref(false)
  return { query, filtered, state: useListQueryState(query, filtered) }
}

describe('useListQueryState', () => {
  it('shows initial loading, a failed load and its successful retry', () => {
    const { query, state } = setup()
    expect(state.listState.value).toBe('loading')
    expect(state.initialLoading.value).toBe(true)
    expect(state.total.value).toBe(0)
    expect(state.empty.value).toBe(false)

    query.isPending.value = false
    query.isError.value = true
    expect(state.listState.value).toBe('error')
    expect(state.loadFailed.value).toBe(true)
    expect(state.refreshFailed.value).toBe(false)

    query.isError.value = false
    query.data.value = { meta: { total: 31 } }
    expect(state.listState.value).toBe('ready')
    expect(state.initialLoading.value).toBe(false)
    expect(state.loadFailed.value).toBe(false)
    expect(state.total.value).toBe(31)
  })

  it('keeps existing rows available when a refresh fails', () => {
    const { query, state } = setup()
    query.isPending.value = false
    query.data.value = { meta: { total: 8 } }
    query.isError.value = true

    expect(state.listState.value).toBe('ready')
    expect(state.total.value).toBe(8)
    expect(state.loadFailed.value).toBe(false)
    expect(state.refreshFailed.value).toBe(true)
    expect(state.empty.value).toBe(false)
  })

  it('distinguishes an empty collection from filters with no matches', () => {
    const { query, filtered, state } = setup()
    query.isPending.value = false
    query.data.value = { meta: { total: 0 } }
    expect(state.listState.value).toBe('empty')
    expect(state.empty.value).toBe(true)
    expect(state.noMatches.value).toBe(false)

    filtered.value = true
    expect(state.noMatches.value).toBe(true)

    query.data.value = { meta: { total: 1 } }
    expect(state.listState.value).toBe('ready')
    expect(state.empty.value).toBe(false)
    expect(state.noMatches.value).toBe(false)
  })

  it('does not show an empty state from the previous filters while loading their replacement', () => {
    const { query, filtered, state } = setup()
    query.isPending.value = false
    query.data.value = { meta: { total: 0 } }
    filtered.value = true
    query.isPlaceholderData.value = true
    expect(state.listState.value).toBe('ready')
    expect(state.empty.value).toBe(false)
    expect(state.noMatches.value).toBe(false)

    query.isPlaceholderData.value = false
    expect(state.listState.value).toBe('empty')
    expect(state.noMatches.value).toBe(true)
  })
})
