// Helpers of the spam filter component tests: a router with the routes the panels link to, a
// settling helper, and the mock requests of the spam policy operations.
import { flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { mockState } from '../../../mocks/node'

const Stub = defineComponent({ render: () => null })

export function spamFilterRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Stub },
      { path: '/spam-filter', name: 'spam-filter', component: Stub },
      { path: '/audit-log', name: 'audit-log', component: Stub },
      { path: '/domains/:domain', name: 'domain-detail', component: Stub },
      { path: '/alias-domains/:aliasDomain', name: 'alias-domain-detail', component: Stub },
      { path: '/mailboxes/:address', name: 'mailbox-detail', component: Stub },
    ],
  })
}

export async function settle(times = 6): Promise<void> {
  for (let index = 0; index < times; index += 1) await flushPromises()
}

/** The spam policy requests the mock received, as "METHOD path". */
export function policyRequests(method?: string): string[] {
  return mockState()
    .requests.filter(
      (request) =>
        /\/(spam-score|spam-policy-entries)/.test(request.path) &&
        (!method || request.method === method),
    )
    .map((request) => `${request.method} ${decodeURIComponent(request.path)}`)
}

/** The body of the last request of a method to a spam policy path. */
export function lastBody(method: string): unknown {
  const requests = mockState().requests.filter(
    (request) =>
      request.method === method && /\/(spam-score|spam-policy-entries)/.test(request.path),
  )
  return requests.at(-1)?.body
}
