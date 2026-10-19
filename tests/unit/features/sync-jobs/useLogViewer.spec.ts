// The log viewer's address (UI 008 T064, research R17): opening pushes `log=<id>`, closing goes
// back when the viewer was opened in the app and otherwise replaces the address, and the focus
// returns to the control that opened it.
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useLogViewer } from '@/features/sync-jobs/composables/useLogViewer'
import { useSyncJobListState } from '@/features/sync-jobs/list-state'

async function setup(path: string) {
  const router = createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [{ path: '/sync-jobs', component: { render: () => null } }],
  })
  await router.push(path)
  await router.isReady()
  let viewer!: ReturnType<typeof useLogViewer>
  mount(
    defineComponent({
      setup() {
        const list = useSyncJobListState('admin')
        viewer = useLogViewer(list)
        return () =>
          h('div', [
            h('h1', { tabindex: -1 }, 'Sync jobs'),
            h('button', { id: 'opener' }, 'Open logs'),
          ])
      },
    }),
    { global: { plugins: [router] }, attachTo: document.body },
  )
  await flushPromises()
  return { router, viewer }
}

describe('useLogViewer', () => {
  it('pushes the log on open and goes back on close, returning the focus', async () => {
    const { router, viewer } = await setup('/sync-jobs?page=2')
    const opener = document.getElementById('opener')!
    opener.focus()
    await viewer.open(7)
    expect(router.currentRoute.value.query).toEqual({ page: '2', log: '7' })
    expect(viewer.openId.value).toBe(7)
    await viewer.close()
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(router.currentRoute.value.query).toEqual({ page: '2' })
    expect(document.activeElement).toBe(opener)
  })

  it('replaces the address when the log was opened directly, and focuses the heading', async () => {
    const { router, viewer } = await setup('/sync-jobs?log=5')
    expect(viewer.openId.value).toBe(5)
    await viewer.close()
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(router.currentRoute.value.query).toEqual({})
    expect(document.activeElement?.tagName).toBe('H1')
  })
})
