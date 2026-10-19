// Mounts a UI 004 page inside a RouterView of the app's route map, at its own route, so that its
// route guards (the leave guard, the section guard) and address handling run as in the app, next to
// the app's confirmation dialog (App.vue). The other routes stay stubs (tests/unit/support/router.ts),
// and the viewport is narrow or wide. Each mounted page is unmounted after its test, after any open
// confirmation is cancelled.
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach } from 'vitest'
import { defineComponent, h, type Component } from 'vue'
import { RouterView } from 'vue-router'

import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import { settleConfirm } from '@/shared/composables/useConfirm'

import { installMatchMedia } from '../../support/media'
import { mountWithApp } from '../../support/mount'
import { createTestRouter } from '../../support/router'

const mounted: VueWrapper[] = []

afterEach(async () => {
  settleConfirm(false)
  await flushPromises()
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})

export async function mountPage(
  page: Component,
  routeName: string,
  path: string,
  options: { wide?: boolean } = {},
) {
  installMatchMedia({ '(min-width: 768px)': options.wide ?? true })
  const router = createTestRouter()
  const record = router.getRoutes().find((route) => route.name === routeName)
  if (!record) throw new Error(`Unknown route ${routeName}`)
  record.components = { default: page }
  await router.push(path)
  const wrapper = mountWithApp(
    defineComponent({ render: () => h('div', [h(RouterView), h(ConfirmDialog)]) }),
    {
      global: { plugins: [router] },
      attachTo: document.body,
    },
  )
  mounted.push(wrapper)
  await flushPromises()
  return { wrapper, router }
}
