// The domain list's address parameters (UI 002 T036, data-model §5): parsed, normalised and mapped
// to the `listDomains` query.
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { componentsParametersDomainSortValues } from '@/api'
import { useDomainListState } from '@/features/domains/list-state'

async function setup(path: string) {
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/domains', component: { render: () => null } }],
  })
  await router.push(path)
  let list!: ReturnType<typeof useDomainListState>
  mount(
    defineComponent({
      setup() {
        list = useDomainListState()
        return () => h('div')
      },
    }),
    { global: { plugins: [router] } },
  )
  await flushPromises()
  return { router, list }
}

describe('domain list state', () => {
  it('defaults to the first 25 by name, ascending', async () => {
    const { list } = await setup('/domains')
    expect(list.params.value).toEqual({ limit: 25, offset: 0, sort: 'name', order: 'asc' })
  })

  it('maps search, active, relay and repeated tags', async () => {
    const { list } = await setup(
      '/domains?q=cust&active=inactive&relay=relay&tag=customer-a&tag=gold&page=3&size=50&sort=storageUsed&order=desc',
    )
    expect(list.params.value).toEqual({
      limit: 50,
      offset: 100,
      sort: 'storageUsed',
      order: 'desc',
      q: 'cust',
      active: false,
      backupMx: true,
      tag: ['customer-a', 'gold'],
    })
    const local = await setup('/domains?active=active&relay=local')
    expect(local.list.params.value).toMatchObject({ active: true, backupMx: false })
  })

  it('accepts every sort key of the contract', async () => {
    for (const sort of componentsParametersDomainSortValues) {
      const { list } = await setup(`/domains?sort=${sort}`)
      expect(list.params.value.sort).toBe(sort)
    }
  })

  it('drops invalid values from the address', async () => {
    const { router, list } = await setup(
      `/domains?active=maybe&relay=x&sort=bogus&size=7&tag=${'x'.repeat(256)}`,
    )
    expect(list.params.value).toEqual({ limit: 25, offset: 0, sort: 'name', order: 'asc' })
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('counts the active filters', async () => {
    const { list } = await setup('/domains?q=x&active=active&tag=a')
    expect(list.activeFilterCount.value).toBe(2)
  })
})
