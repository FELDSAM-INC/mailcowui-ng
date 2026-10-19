// Helpers of the MTA-STS component tests: a router with the routes the section links to, and a
// mounted section on the mock API.
import { flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { MtaStsPolicy } from '@/api'

const Stub = defineComponent({ render: () => null })

export function mtaStsRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Stub },
      { path: '/audit-log', name: 'audit-log', component: Stub },
      { path: '/domains', name: 'domains', component: Stub },
      { path: '/domains/:domain', name: 'domain-detail', component: Stub },
    ],
  })
}

export async function settle(times = 4): Promise<void> {
  for (let index = 0; index < times; index += 1) await flushPromises()
}

export function policy(overrides: Partial<MtaStsPolicy> = {}): MtaStsPolicy {
  return {
    domain: 'example.org',
    displayDomain: 'example.org',
    version: 'STSv1',
    mode: 'enforce',
    mxHosts: ['mail.example.org'],
    maxAge: 604_800,
    active: true,
    policyId: '20261018100000',
    policyUrl: 'https://mta-sts.example.org/.well-known/mta-sts.txt',
    policyText: 'version: STSv1\nmode: enforce\nmx: mail.example.org\nmax_age: 604800\n',
    dnsRecords: [
      { name: '_mta-sts.example.org', type: 'TXT', value: 'v=STSv1;id=20261018100000;' },
      { name: 'mta-sts.example.org', type: 'CNAME', value: 'mail.example.org' },
    ],
    etag: '"p1"',
    ...overrides,
  }
}
