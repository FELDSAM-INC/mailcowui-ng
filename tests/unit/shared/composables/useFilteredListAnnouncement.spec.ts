import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'

import { i18n, loadLegacy } from '@/i18n'
import * as announcer from '@/shared/composables/useAnnouncer'
import { useFilteredListAnnouncement } from '@/shared/composables/useFilteredListAnnouncement'

import { withSetup } from '../../support/composable'

function setup() {
  const query = {
    data: ref<{ meta: { total: number } }>(),
    isPlaceholderData: ref(false),
  }
  const state = ref({
    filters: { q: '', active: undefined as boolean | undefined },
    page: 1,
    size: 25,
    sort: 'name',
  })
  const announce = vi.spyOn(announcer, 'announce').mockImplementation(() => undefined)
  const host = withSetup(() => useFilteredListAnnouncement(query, state))
  return { query, state, announce, unmount: host.unmount }
}

describe('useFilteredListAnnouncement', () => {
  it('waits for both totals when a policy list combines its own and inherited results', async () => {
    const ownTotal = ref<number>()
    const inheritedTotal = ref<number>()
    const state = ref({ filters: { q: '' }, page: 1, size: 25 })
    const announce = vi.spyOn(announcer, 'announce').mockImplementation(() => undefined)
    const host = withSetup(() =>
      useFilteredListAnnouncement(
        {
          data: computed(() =>
            ownTotal.value === undefined || inheritedTotal.value === undefined
              ? undefined
              : { meta: { total: ownTotal.value + inheritedTotal.value } },
          ),
          isPlaceholderData: ref(false),
        },
        state,
      ),
    )
    state.value.filters.q = 'example'
    ownTotal.value = 2
    await nextTick()
    expect(announce).not.toHaveBeenCalled()
    inheritedTotal.value = 1
    await nextTick()
    expect(announce).toHaveBeenCalledExactlyOnceWith('Showing 1 to 3 of 3 entries')
    host.unmount()
  })

  it('preserves a feature summary using the returned offset and row count', async () => {
    const query = {
      data: ref<{ meta: { total: number; offset: number }; data: string[] }>(),
      isPlaceholderData: ref(false),
    }
    const state = ref({ filters: { q: '' }, page: 2, size: 25 })
    const announce = vi.spyOn(announcer, 'announce').mockImplementation(() => undefined)
    const host = withSetup(() =>
      useFilteredListAnnouncement(query, state, (data) =>
        data.meta.total === 0
          ? 'No matching records found'
          : `${data.meta.offset + 1}–${data.meta.offset + data.data.length} / ${data.meta.total}`,
      ),
    )
    state.value.filters.q = 'queued'
    query.data.value = { meta: { total: 50, offset: 7 }, data: ['one', 'two'] }
    await nextTick()
    expect(announce).toHaveBeenCalledExactlyOnceWith('8–9 / 50')

    state.value.filters.q = 'missing'
    query.data.value = { meta: { total: 0, offset: 0 }, data: [] }
    await nextTick()
    expect(announce).toHaveBeenLastCalledWith('No matching records found')
    host.unmount()
  })

  it('waits for filtered results and ignores the initial load, filter typing and placeholder data', async () => {
    const { query, state, announce, unmount } = setup()
    query.data.value = { meta: { total: 91 } }
    await nextTick()
    expect(announce).not.toHaveBeenCalled()

    state.value.filters.q = 'invoice'
    await nextTick()
    expect(announce).not.toHaveBeenCalled()
    query.isPlaceholderData.value = true
    await nextTick()
    expect(announce).not.toHaveBeenCalled()

    query.data.value = { meta: { total: 3 } }
    query.isPlaceholderData.value = false
    await nextTick()
    expect(announce).toHaveBeenCalledExactlyOnceWith('Showing 1 to 3 of 3 entries')
    unmount()
  })

  it('announces once per filter change, including clearing filters, but not for paging or sorting', async () => {
    const { query, state, announce, unmount } = setup()
    query.data.value = { meta: { total: 91 } }
    await nextTick()
    state.value.filters.active = true
    query.data.value = { meta: { total: 36 } }
    await nextTick()
    expect(announce).toHaveBeenLastCalledWith('Showing 1 to 25 of 36 entries')

    state.value.page = 2
    state.value.sort = 'domain'
    query.data.value = { meta: { total: 36 } }
    await nextTick()
    query.data.value = { meta: { total: 35 } }
    await nextTick()
    expect(announce).toHaveBeenCalledTimes(1)

    state.value.filters.active = undefined
    state.value.page = 1
    query.data.value = { meta: { total: 91 } }
    await nextTick()
    expect(announce).toHaveBeenCalledTimes(2)
    expect(announce).toHaveBeenLastCalledWith('Showing 1 to 25 of 91 entries')
    unmount()
  })

  it('uses the latest filter state when several changes happen during placeholder loading', async () => {
    const { query, state, announce, unmount } = setup()
    query.data.value = { meta: { total: 91 } }
    await nextTick()
    query.isPlaceholderData.value = true
    state.value.filters.q = 'invoice'
    await nextTick()
    state.value.filters.q = 'nothing'
    await nextTick()
    query.data.value = { meta: { total: 0 } }
    await nextTick()
    expect(announce).not.toHaveBeenCalled()

    query.isPlaceholderData.value = false
    await nextTick()
    expect(announce).toHaveBeenCalledExactlyOnceWith('Showing 0 to 0 of 0 entries')
    unmount()
  })

  it('uses the active translation, localized numbers and the current page range when results arrive', async () => {
    const { query, state, announce, unmount } = setup()
    query.data.value = { meta: { total: 2000 } }
    await nextTick()
    state.value.filters.q = 'room'
    state.value.page = 13
    state.value.size = 100
    i18n.global.locale.value = 'cs-cz'
    await loadLegacy('cs-cz')
    await nextTick()
    expect(announce).not.toHaveBeenCalled()

    query.data.value = { meta: { total: 1234 } }
    await nextTick()
    expect(announce).toHaveBeenCalledExactlyOnceWith(
      'Zobrazuji 1\u00a0201 až 1\u00a0234 z celkem 1\u00a0234 záznamů',
    )
    unmount()
  })

  it('does not announce absent data or results after the page unmounts', async () => {
    const { query, state, announce, unmount } = setup()
    state.value.filters.q = 'late'
    query.isPlaceholderData.value = true
    await nextTick()
    query.isPlaceholderData.value = false
    await nextTick()
    expect(announce).not.toHaveBeenCalled()

    unmount()
    query.data.value = { meta: { total: 2 } }
    await nextTick()
    expect(announce).not.toHaveBeenCalled()
  })
})
