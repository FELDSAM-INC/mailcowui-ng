// Mount helpers for component tests: every test gets a fresh Pinia and QueryClient
// (research R23). The app's i18n instance is added by T055.
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount, type ComponentMountingOptions } from '@vue/test-utils'
import { createPinia, type Pinia } from 'pinia'
import type { Component } from 'vue'

export interface TestPlugins {
  pinia: Pinia
  queryClient: QueryClient
}

let current: TestPlugins | null = null

export function resetTestPlugins(): TestPlugins {
  current = {
    pinia: createPinia(),
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
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
  const { pinia, queryClient } = testPlugins()
  return mount(component, {
    ...options,
    global: {
      ...options.global,
      plugins: [pinia, [VueQueryPlugin, { queryClient }], ...(options.global?.plugins ?? [])],
    },
  })
}
