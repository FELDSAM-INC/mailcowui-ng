// Mounts a routing page through its real route (UI 009 unit tests): the feature's routes with
// their lazy page components, stand-ins for the routes other features own, the mock API on a
// scenario, and the wide or narrow layout.
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView, type RouteRecordRaw } from 'vue-router'

import { routingRoutes } from '@/features/routing'
import ConfirmHost from '@/shared/components/ConfirmDialog.vue'
import type { ScenarioOverrides } from '../../../../mocks/scenarios'

import { useScenario } from '../../../../mocks/node'
import { installMatchMedia } from '../../../support/media'
import { mountWithApp } from '../../../support/mount'

const mounted: VueWrapper[] = []

// Every page is attached to the document (dialogs teleport there), so each is removed after its test.
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
})

const Stub = defineComponent({ name: 'RouteStub', setup: () => () => h('h1', 'stub') })

const OTHERS: RouteRecordRaw[] = [
  { path: '/audit-log', name: 'audit-log', component: Stub },
  { path: '/domains/:domain', name: 'domain-detail', component: Stub },
  { path: '/mailboxes/:address', name: 'mailbox-detail', component: Stub },
  { path: '/:rest(.*)*', name: 'not-found', component: Stub },
]

export async function mountRoute(
  path: string,
  options: { scenario?: string; overrides?: ScenarioOverrides; wide?: boolean } = {},
) {
  useScenario(options.scenario ?? 'routing-admin-default', options.overrides)
  installMatchMedia({ '(min-width: 768px)': options.wide ?? true })
  const router = createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [...routingRoutes, ...OTHERS],
  })
  await router.push(path)
  await router.isReady()
  const App = defineComponent({ setup: () => () => [h(RouterView), h(ConfirmHost)] })
  const host = document.createElement('div')
  document.body.appendChild(host)
  const wrapper = mountWithApp(App, { attachTo: host, global: { plugins: [router] } })
  mounted.push(wrapper)
  await settle()
  return { wrapper, router }
}

/** Lets queries, lazy routes and timers of the mock settle. */
export async function settle(rounds = 6): Promise<void> {
  for (let round = 0; round < rounds; round++) {
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

/** Waits until the callback stops throwing. */
export function until<T>(callback: () => T, timeout = 10_000): Promise<T> {
  return vi.waitFor(callback, { timeout, interval: 20 })
}
