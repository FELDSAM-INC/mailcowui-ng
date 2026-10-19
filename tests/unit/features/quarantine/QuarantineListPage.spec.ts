import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { api } from '@/api'
import * as confirmations from '@/features/quarantine/confirmations'
import QuarantineListPage from '@/features/quarantine/pages/QuarantineListPage.vue'

import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

const mounted: { unmount(): void }[] = []
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})
const Stub = defineComponent({ render: () => null })

async function settle() {
  for (let i = 0; i < 8; i++) await flushPromises()
}

async function open(scenario = 'quarantine-mailbox-user', query = '') {
  useScenario(scenario)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/quarantine', name: 'quarantine', component: QuarantineListPage },
      { path: '/quarantine/:itemId', name: 'quarantine-item', component: Stub },
    ],
  })
  await router.push(`/quarantine${query}`)
  const wrapper = mountWithApp(QuarantineListPage, { global: { plugins: [router] } })
  mounted.push(wrapper)
  await settle()
  return { wrapper, router }
}

describe('QuarantineListPage', () => {
  it('shows the newest 25 own items, status, details and pagination', async () => {
    const { wrapper, router } = await open()
    const cards = wrapper.findAll('[data-quarantine-item]')
    expect(cards).toHaveLength(25)
    expect(cards[0]!.attributes('data-quarantine-item')).toBe('30')
    expect(cards[24]!.attributes('data-quarantine-item')).toBe('6')
    expect(wrapper.get('h1').text()).toContain('Quarantine')
    expect(wrapper.get('[data-quarantine-active]').text()).toContain('20')
    expect(wrapper.get('[data-quarantine-active]').text()).toContain('15')
    expect(cards[0]!.get('h2 a').attributes('href')).toBe('/quarantine/30')
    await wrapper.get('button[aria-label="Next"]').trigger('click')
    await settle()
    expect(router.currentRoute.value.query.page).toBe('2')
    expect(wrapper.findAll('[data-quarantine-item]')).toHaveLength(5)
  })

  it('restores filters and sort from the address, and ignores mailbox scope filters', async () => {
    const read = vi.spyOn(api, 'GET')
    const { wrapper } = await open(
      'quarantine-mailbox-user',
      '?virus=true&sort=id&order=asc&recipient=bob%40example.org&domain=elsewhere.org',
    )
    expect(read).toHaveBeenCalledWith('/quarantine', {
      params: { query: { limit: 25, offset: 0, virus: true, sort: 'id', order: 'asc' } },
    })
    expect(wrapper.findAll('[data-quarantine-item]')).toHaveLength(1)
    expect(wrapper.find('[data-virus="true"]').exists()).toBe(true)
  })

  it('clears a search with no matches and returns to the first page', async () => {
    const { wrapper, router } = await open('quarantine-mailbox-user', '?q=absent-message')
    expect(wrapper.get('[data-no-matches]').text()).toContain('No matching records found')
    await wrapper.get('[data-no-matches] button').trigger('click')
    await settle()
    expect(router.currentRoute.value.query).toEqual({})
    expect(wrapper.findAll('[data-quarantine-item]')).toHaveLength(25)
  })

  it('shows an empty quarantine separately from filtered results', async () => {
    const { wrapper } = await open('quarantine-empty')
    expect(wrapper.get('[data-empty]').text()).toBe('No data available in table')
    expect(wrapper.find('[data-no-matches]').exists()).toBe(false)
  })

  it('keeps hostile message values inert and marks bidi controls', async () => {
    const { wrapper } = await open('quarantine-mailbox-user', '?sort=id&order=asc')
    expect(wrapper.find('[data-quarantine-item="11"] script').exists()).toBe(false)
    expect(wrapper.find('[data-quarantine-item="12"] img').exists()).toBe(false)
    expect(wrapper.get('[data-quarantine-item="13"]').text()).toContain('U+202E')
    expect(wrapper.get('[data-quarantine-item="8"] h2').text()).toBe('-')
  })

  it('reloads an outdated removal before asking again with the new version', async () => {
    const ask = vi.spyOn(confirmations, 'askItemAction').mockResolvedValue(true)
    const { wrapper } = await open()
    const stored = mockState().quarantine.items.find((item) => item.id === 30)!
    stored.queueId = 'CHANGEDQUEUE30'
    stored.subject = 'Changed message'
    const writes = () =>
      mockState().requests.filter((request) => request.operationId === 'deleteQuarantineItem')
    await wrapper.get('[data-quarantine-item="30"] button').trigger('click')
    await settle()
    expect(writes().map((request) => request.status)).toEqual([412])
    expect(wrapper.get('[data-quarantine-item="30"] h2').text()).toBe('Changed message')
    expect(ask).toHaveBeenCalledTimes(1)
    await wrapper.get('[data-quarantine-item="30"] button').trigger('click')
    await settle()
    expect(writes().map((request) => request.status)).toEqual([412, 204])
    expect(ask).toHaveBeenCalledTimes(2)
    expect(writes()[1]!.headers['if-match']).not.toBe(writes()[0]!.headers['if-match'])
    expect(wrapper.find('[data-quarantine-item="30"]').exists()).toBe(false)
  })
})
