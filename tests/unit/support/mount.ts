// Mount helpers for component tests: every test gets a fresh Pinia and QueryClient, and the app's
// i18n instance reset to the real en-gb messages (research R23). The app's own instance is used,
// so that language changes made by the code under test reach the mounted components.
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount, type ComponentMountingOptions } from '@vue/test-utils'
import { createPinia, type Pinia } from 'pinia'
import type { Component } from 'vue'

import { i18n, type AppI18n } from '@/i18n'

export interface TestPlugins {
  pinia: Pinia
  queryClient: QueryClient
  i18n: AppI18n
}

let current: TestPlugins | null = null

export function resetTestPlugins(): TestPlugins {
  current = {
    pinia: createPinia(),
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    i18n,
  }
  i18n.global.locale.value = 'en-gb'
  document.documentElement.lang = 'en-GB'
  return current
}

export function testPlugins(): TestPlugins {
  return current ?? resetTestPlugins()
}

export function mountWithApp<C extends Component>(
  component: C,
  options: ComponentMountingOptions<C> = {},
) {
  const { pinia, queryClient, i18n } = testPlugins()
  return mount(component, {
    ...options,
    global: {
      ...options.global,
      plugins: [pinia, [VueQueryPlugin, { queryClient }], i18n, ...(options.global?.plugins ?? [])],
    },
  })
}
