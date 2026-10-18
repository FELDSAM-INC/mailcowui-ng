// Runs a composable inside a mounted component with the app's plugins (Pinia, Vue Query, i18n and
// optionally a router), so that `useI18n`, `useQuery` and lifecycle hooks work.
import { defineComponent, h } from 'vue'
import type { Router } from 'vue-router'

import { mountWithApp } from './mount'

export function withSetup<T>(setup: () => T, options: { router?: Router } = {}) {
  let result!: T
  const Host = defineComponent({
    setup() {
      result = setup()
      return () => h('div')
    },
  })
  const wrapper = mountWithApp(Host, {
    global: { plugins: options.router ? [options.router] : [] },
  })
  return { result, wrapper, unmount: () => wrapper.unmount() }
}
