// The not-found page's back link (UI 002 T020, FR-004) and the pagination actions (FR-005).
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import NotFoundPage from '@/app/states/NotFoundPage.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'

import { mountWithApp } from '../../support/mount'

describe('NotFoundPage', () => {
  it('links back to the given list instead of home', async () => {
    const router = createRouter({
      history: createMemoryHistory('/ng/'),
      routes: [
        { path: '/', component: { render: () => null } },
        { path: '/domains', name: 'domains', component: { render: () => null } },
      ],
    })
    const wrapper = mountWithApp(NotFoundPage, {
      props: { backTo: { name: 'domains' }, backLabel: 'Back to the domains' },
      global: { plugins: [router] },
    })
    await flushPromises()
    const link = wrapper.get('a')
    expect(link.attributes('href')).toBe('/ng/domains')
    expect(link.text()).toBe('Back to the domains')
  })
})

describe('PaginationBar', () => {
  it('offers first, previous, next and last page and names the page', async () => {
    const wrapper = mountWithApp(PaginationBar, { props: { total: 60, page: 2, size: 25 } })
    expect(wrapper.text()).toContain('Page 2 of 3')
    const button = (label: string) => wrapper.get(`button[aria-label="${label}"]`)
    await button('First').trigger('click')
    await button('Previous').trigger('click')
    await button('Next').trigger('click')
    await button('Last').trigger('click')
    expect(wrapper.emitted('update:page')).toEqual([[1], [1], [3], [3]])
    await wrapper.setProps({ page: 1 })
    expect(button('First').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ page: 3 })
    expect(button('Last').attributes('disabled')).toBeDefined()
  })
})
