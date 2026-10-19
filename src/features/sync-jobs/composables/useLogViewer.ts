// The log viewer's address (UI 008 research R17): opening pushes `log=<id>` onto the list's
// address (a view parameter: it resets neither the page nor the selection), so Back closes the
// full-screen viewer and a log can be linked; closing goes back when the viewer was opened in the
// app and otherwise replaces the address. The focus returns to the control that opened it, or to
// the page's heading.
import { computed, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { UseListState } from '@/shared/composables/useListState'

import type { SyncJobListViews } from '../list-state'

type ListWithViews = Pick<UseListState<unknown, string, SyncJobListViews>, 'views' | 'setView'>

export function useLogViewer(list: ListWithViews) {
  const route = useRoute()
  const router = useRouter()
  let opener: HTMLElement | null = null

  function restoreFocus() {
    const target =
      opener?.isConnected === true ? opener : document.querySelector<HTMLElement>('main h1, h1')
    opener = null
    target?.focus()
  }

  const openId = computed(() => list.views.value.log)
  // However the viewer closes (Close, Escape, Back), the focus returns once it is gone.
  watch(openId, (id, previous) => {
    if (id !== undefined || previous === undefined) return
    void nextTick(() => requestAnimationFrame(restoreFocus))
  })

  return {
    openId,
    async open(id: number) {
      const active = document.activeElement
      opener = active instanceof HTMLElement ? active : null
      await list.setView('log', id)
    },
    async close() {
      const query = { ...route.query }
      delete query.log
      const target = router.resolve({ query, hash: route.hash }).fullPath
      if (router.options.history.state.back === target) router.back()
      else await list.setView('log', undefined, { replace: true })
    },
  }
}
