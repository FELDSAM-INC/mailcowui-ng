// The MTA-STS policies overview (T066, FR-054 to FR-056): every policy in scope as a card or a
// table row with the readable domain, the active badge, mode, MX hosts, max age and identifier,
// linking to the domain page's MTA-STS section.
import { describe, expect, it, vi } from 'vitest'

import { flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import MtaStsPolicyCard from '@/features/dns/components/MtaStsPolicyCard.vue'
import MtaStsPolicyTable from '@/features/dns/components/MtaStsPolicyTable.vue'

import MtaStsPoliciesPage from '@/features/dns/pages/MtaStsPoliciesPage.vue'

import { useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'
import { mtaStsRouter, policy, settle } from './mta-sts-fixtures'

describe('MTA-STS policy entries', () => {
  it('shows every FR-055 value on a card linking to the section', async () => {
    const router = mtaStsRouter()
    const wrapper = mountWithApp(MtaStsPolicyCard, {
      props: {
        policy: policy({ domain: 'xn--bcher-kva.example', displayDomain: 'bücher.example' }),
      },
      global: { plugins: [router] },
    })
    await settle()
    expect(wrapper.element.tagName).toBe('LI')
    const heading = wrapper.get('h3')
    expect(heading.text()).toContain('bücher.example')
    expect(heading.get('a').attributes('href')).toBe('/domains/xn--bcher-kva.example#mta-sts')
    for (const value of ['Active', 'enforce', 'mail.example.org', '604,800', '20261018100000']) {
      expect(wrapper.text()).toContain(value)
    }
  })

  it('has a table with sortable headers', async () => {
    const router = mtaStsRouter()
    const wrapper = mountWithApp(MtaStsPolicyTable, {
      props: {
        policies: [
          policy(),
          policy({ domain: 'example.net', displayDomain: 'example.net', active: false }),
        ],
        sort: 'domain',
        order: 'asc',
      },
      global: { plugins: [router] },
    })
    await settle()
    const domain = wrapper.findAll('th').find((th) => th.text().includes('Domain'))!
    expect(domain.attributes('aria-sort')).toBe('ascending')
    const id = wrapper.findAll('th').find((th) => th.text().includes('Policy identifier'))!
    await id.get('button').trigger('click')
    expect(wrapper.emitted('sort')?.[0]).toEqual(['policyId', 'asc'])
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('Inactive')
    const first = wrapper.get('tbody tr')
    const edit = first.get('td:last-child .table-row-controls a')
    expect(edit.text()).toBe('Edit')
    expect(edit.attributes('href')).toBe(first.get('td:first-child a').attributes('href'))
    expect(first.find('td:last-child [aria-expanded]').exists()).toBe(false)
  })
})

const Stub = defineComponent({ render: () => null })

async function mountPage(scenario: string, path = '/dns/mta-sts-policies', wide = true) {
  window.matchMedia = (query: string) => ({
    matches: wide && query.includes('min-width'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })
  useScenario(scenario, {
    dns: {
      policies: {
        'example.net': { mode: 'testing', active: false, maxAge: 86400 },
        'shop.example': { mode: 'none', active: true, maxAge: 3600 },
      },
    },
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dns/mta-sts-policies', name: 'mta-sts-policies', component: MtaStsPoliciesPage },
      { path: '/domains', name: 'domains', component: Stub },
      { path: '/domains/:domain', name: 'domain-detail', component: Stub },
    ],
  })
  await router.push(path)
  const Host = defineComponent({ render: () => h(RouterView) })
  const wrapper = mountWithApp(Host, { global: { plugins: [router] } })
  await settle(8)
  return { wrapper, router }
}

const names = (wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper']) =>
  wrapper.findAll('[data-entry]').map((item) => item.attributes('data-entry'))

describe('MtaStsPoliciesPage', () => {
  it('lists the policies in a table with the total, and filters and sorts through the address', async () => {
    const { wrapper, router } = await mountPage('dns-mta-sts')
    expect(names(wrapper)).toEqual(['example.net', 'example.org', 'shop.example'])
    expect(wrapper.get('[data-result-count]').text()).toBe('3 policies')
    await wrapper.get('[aria-controls="mta-sts-filters"]').trigger('click')
    await wrapper.get('#mta-sts-filter-mode').setValue('testing')
    await settle(8)
    expect(router.currentRoute.value.query.mode).toBe('testing')
    expect(names(wrapper)).toEqual(['example.net'])
    await wrapper.get('#mta-sts-filter-active').setValue('false')
    await settle(8)
    expect(router.currentRoute.value.query.active).toBe('false')
    await wrapper.get('[data-clear-filters]').trigger('click')
    await settle(8)
    expect(names(wrapper)).toHaveLength(3)
    const header = wrapper.findAll('th').find((th) => th.text().includes('Max age'))!
    await header.get('button').trigger('click')
    await settle(8)
    expect(router.currentRoute.value.query.sort).toBe('maxAge')
    expect(names(wrapper)).toEqual(['shop.example', 'example.net', 'example.org'])
  })

  it('shows cards and the sort control below md', async () => {
    const { wrapper, router } = await mountPage('dns-mta-sts', '/dns/mta-sts-policies', false)
    expect(wrapper.findAll('li[data-entry]')).toHaveLength(3)
    await wrapper.get('#mta-sts-sort').setValue('policyId')
    await settle(8)
    expect(router.currentRoute.value.query.sort).toBe('policyId')
    await wrapper.get('#mta-sts-order').setValue('desc')
    await settle(8)
    expect(router.currentRoute.value.query.order).toBe('desc')
  })

  it('explains that policies are set up on a domain page when there are none, and offers to clear a search without matches', async () => {
    const { wrapper } = await mountPage('dns-admin', '/dns/mta-sts-policies?q=zzz')
    expect(wrapper.text()).toContain('No matching records found')
    const clear = wrapper
      .findAll('button')
      .filter((button) => button.text() === 'Clear all filters')
      .at(-1)!
    await clear.trigger('click')
    await flushPromises()
    await vi.waitFor(() => expect(names(wrapper)).toEqual(['example.net', 'shop.example']))
  })
})
