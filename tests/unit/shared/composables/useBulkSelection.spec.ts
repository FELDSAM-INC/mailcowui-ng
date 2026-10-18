// Bulk selection (UI 002 T013, research D22, data-model §2): an explicit selection mode, the
// current page only, cleared with the list state, and the API's bulk limit: "select all" selects
// the first N visible entries and states the limit, and further selection is refused at the limit.
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import { oneOf, text, useListState } from '@/shared/composables/useListState'

describe('useBulkSelection', () => {
  it('enters and leaves selection mode; leaving clears the selection', () => {
    const selection = useBulkSelection()
    expect(selection.active.value).toBe(false)
    selection.enter()
    expect(selection.active.value).toBe(true)
    selection.toggle('a.example')
    expect(selection.count.value).toBe(1)
    selection.leave()
    expect(selection.active.value).toBe(false)
    expect(selection.count.value).toBe(0)
  })

  it('toggles, selects a page and clears', () => {
    const selection = useBulkSelection()
    selection.toggle('a')
    selection.toggle('b')
    selection.toggle('a')
    expect([...selection.ids.value]).toEqual(['b'])
    expect(selection.isSelected('b')).toBe(true)
    selection.selectPage(['a', 'b', 'c'])
    expect([...selection.ids.value]).toEqual(['b', 'a', 'c'])
    expect(selection.allSelected(['a', 'b', 'c'])).toBe(true)
    selection.clear()
    expect(selection.count.value).toBe(0)
  })

  it('keeps only the given IDs after a run', () => {
    const selection = useBulkSelection()
    selection.selectPage(['a', 'b', 'c', 'd'])
    selection.keep(['b', 'd', 'x'])
    expect([...selection.ids.value]).toEqual(['b', 'd'])
  })

  it('reaches the limit: atLimit, refused toggles, and select-all of the first N with a notice', () => {
    const limit = ref<number | null>(3)
    const selection = useBulkSelection({ limit })
    const result = selection.selectPage(['a', 'b', 'c', 'd', 'e'])
    expect(result.cut).toBe(true)
    expect([...selection.ids.value]).toEqual(['a', 'b', 'c'])
    expect(selection.atLimit.value).toBe(true)
    expect(selection.limitReached.value).toBe(true)
    expect(selection.canSelect('d')).toBe(false)
    expect(selection.canSelect('a')).toBe(true)
    expect(selection.toggle('d')).toBe(false)
    expect(selection.isSelected('d')).toBe(false)
    expect(selection.toggle('a')).toBe(true)
    expect(selection.atLimit.value).toBe(false)
    expect(selection.toggle('d')).toBe(true)
    expect(selection.atLimit.value).toBe(true)
    limit.value = null
    expect(selection.atLimit.value).toBe(false)
  })

  it('selecting a page within the limit reports no cut', () => {
    const selection = useBulkSelection({ limit: 10 })
    expect(selection.selectPage(['a', 'b']).cut).toBe(false)
    expect(selection.limitReached.value).toBe(false)
  })

  it('clears through useListState onReset on page, search, filter, sort and size changes', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/list', component: { render: () => null } }],
    })
    await router.push('/list')
    let api!: {
      selection: ReturnType<typeof useBulkSelection>
      list: ReturnType<
        typeof useListState<
          { q: string | undefined; state: 'on' | 'off' | undefined },
          'name' | 'size'
        >
      >
    }
    const Host = defineComponent({
      setup() {
        const selection = useBulkSelection()
        const list = useListState(
          {
            filters: { q: text({ maxLength: 255 }), state: oneOf(['on', 'off'] as const) },
            sort: { values: ['name', 'size'] as const, default: 'name', defaultOrder: () => 'asc' },
          },
          { onReset: selection.clear },
        )
        api = { selection, list }
        return () => h('div')
      },
    })
    mount(Host, { global: { plugins: [router] } })
    await flushPromises()
    const select = () => api.selection.selectPage(['a', 'b'])
    for (const change of [
      () => api.list.setPage(2),
      () => api.list.setFilter('q', 'x', { typing: true }),
      () => api.list.setFilter('state', 'on'),
      () => api.list.setSort('size', 'desc'),
      () => api.list.setSize(50),
    ]) {
      select()
      expect(api.selection.count.value).toBe(2)
      await change()
      await flushPromises()
      expect(api.selection.count.value).toBe(0)
    }
  })
})
