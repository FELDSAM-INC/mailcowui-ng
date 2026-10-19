// The DNS diagnostics page (T061, FR-057 to FR-069) against the mock: the classic heading and
// notice, the checks grouped and translated, the attention filter, a held result reused without a
// new run, "Run again", the changed notice, the rate limit, and the not-found page.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { defineComponent, h } from 'vue'

import { queryKeys } from '@/api'
import DnsDiagnosticsPage from '@/features/dns/pages/DnsDiagnosticsPage.vue'

import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'

const Stub = defineComponent({ render: () => null })

async function open(path = '/dns/diagnostics/example.org') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dns/diagnostics/:diagnosticsName', component: DnsDiagnosticsPage },
      { path: '/dns/dkim-keys', name: 'dkim-keys', component: Stub },
    ],
  })
  await router.push(path)
  const Host = defineComponent({ render: () => h(RouterView) })
  const wrapper = mountWithApp(Host, { global: { plugins: [router] }, attachTo: document.body })
  return { wrapper, router }
}

const runs = () =>
  mockState().requests.filter((request) => request.operationId === 'runDnsDiagnostics').length

describe('DnsDiagnosticsPage', () => {
  it('runs on opening and shows the classic heading, the groups and the zone file', async () => {
    useScenario('dns-diagnostics-all-statuses')
    const { wrapper } = await open()
    await vi.waitFor(() => expect(wrapper.find('[data-diagnostics-summary]').exists()).toBe(true))
    expect(wrapper.get('h1').text()).toBe('DNS Records')
    expect(wrapper.text()).toContain('Please note that changes made to DNS may take up to 24 hours')
    const headings = wrapper.findAll('h2').map((heading) => heading.text())
    expect(headings).toEqual(
      expect.arrayContaining([
        'Summary',
        'Server',
        'Server-wide records',
        'Records of this name',
        'Zone file',
      ]),
    )
    expect(wrapper.get('[data-diagnostics-partial]').text()).toContain(
      'Some records could not be checked',
    )
    expect(wrapper.text()).toContain('Could not be checked')
    expect(wrapper.text()).toContain('Cannot be verified')
    expect(runs()).toBe(1)
    wrapper.unmount()
  })

  it('keeps only the checks that need a look with the filter', async () => {
    useScenario('dns-diagnostics-all-statuses')
    const { wrapper } = await open()
    await vi.waitFor(() => expect(wrapper.find('[data-diagnostics-summary]').exists()).toBe(true))
    const before = wrapper.findAll('[data-check]').length
    await wrapper.get('[data-diagnostics-summary] input[type="checkbox"]').setValue(true)
    const after = wrapper.findAll('[data-check]')
    expect(after.length).toBeLessThan(before)
    expect(after.map((item) => item.attributes('data-check-id'))).not.toContain('mx')
    wrapper.unmount()
  })

  it('reuses a held result, runs again on request and says when a key changed afterwards', async () => {
    useScenario('dns-admin')
    const first = await open()
    await vi.waitFor(() =>
      expect(first.wrapper.find('[data-diagnostics-summary]').exists()).toBe(true),
    )
    first.wrapper.unmount()
    const { wrapper } = await open()
    await flushPromises()
    expect(runs()).toBe(1)
    testPlugins().queryClient.setQueryData(queryKeys.dnsDiagnostics.changed('example.org'), {
      changedAt: Date.now() + 1000,
    })
    await flushPromises()
    expect(wrapper.get('[data-diagnostics-changed]').text()).toContain('changed after this check')
    await wrapper.get('[data-run-again]').trigger('click')
    await vi.waitFor(() => expect(runs()).toBe(2))
    wrapper.unmount()
  })

  it('shows the runs left and blocks a run when none is left', async () => {
    useScenario('dns-diagnostics-rate-limited')
    const { wrapper } = await open()
    await vi.waitFor(() => expect(wrapper.find('[data-run-remaining]').exists()).toBe(true))
    expect(wrapper.get('[data-run-remaining]').text()).toContain('2')
    mockState().dns.rateLimit.remaining = 0
    await wrapper.get('[data-run-again]').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-run-blocked]').exists()).toBe(true))
    expect(wrapper.get('[data-run-again]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-diagnostics-summary]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows the not-found page for a name outside the scope', async () => {
    useScenario('dns-domain-admin')
    const { wrapper } = await open('/dns/diagnostics/shop.example')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Page not found'))
    wrapper.unmount()
  })

  it('leaves out the server-wide records for a domain administrator', async () => {
    useScenario('dns-domain-admin')
    const { wrapper } = await open()
    await vi.waitFor(() => expect(wrapper.find('[data-diagnostics-summary]').exists()).toBe(true))
    expect(wrapper.text()).not.toContain('Server-wide records')
    expect(wrapper.get('[data-result-notes]').text()).toContain('administrators only')
    wrapper.unmount()
  })
})
