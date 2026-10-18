// Mount helpers for component tests: every test gets a fresh Pinia, QueryClient and i18n instance
// with the real en-gb messages (research R23).
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount, type ComponentMountingOptions } from '@vue/test-utils'
import { createPinia, type Pinia } from 'pinia'
import type { Component } from 'vue'

import { createAppI18n, type AppI18n } from '@/i18n'

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
    i18n: createAppI18n(),
  }
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
