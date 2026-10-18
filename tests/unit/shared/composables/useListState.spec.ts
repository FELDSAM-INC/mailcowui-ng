// List state in the address (data-model §5, research R20, conventions "Lists"): parsing and
// normalisation, defaults omitted, page sizes 25/50/100, resets, push versus replace, the mapping
// to limit and offset, and nothing in storage.
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import {
  manyOf,
  oneOf,
  text,
  useListState,
  type ListSchema,
} from '@/shared/composables/useListState'

type Filters = {
  owner: string | undefined
  status: 'active' | 'expired' | 'revoked' | undefined
  event: string[]
}
type Sort = 'createdAt' | 'name' | 'expiresAt'

const schema: ListSchema<Filters, Sort> = {
  filters: {
    owner: text({ maxLength: 255 }),
    status: oneOf(['active', 'expired', 'revoked'] as const),
    event: manyOf(['signIn', 'signOut', 'apiKeyCreation'] as const, { max: 2 }),
  },
  sort: {
    values: ['createdAt', 'name', 'expiresAt'],
    default: 'createdAt',
    defaultOrder: (sort) => (sort === 'createdAt' ? 'desc' : 'asc'),
  },
}

async function setup(path: string, onReset = vi.fn()) {
  const router = createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [{ path: '/keys', name: 'keys', component: { render: () => null } }],
  })
  await router.push(path)
  await router.isReady()
  const positionBefore = router.options.history.state.position
  let list!: ReturnType<typeof useListState<Filters, Sort>>
  const Host = defineComponent({
    setup() {
      list = useListState(schema, { onReset })
      return () => h('div')
    },
  })
  mount(Host, { global: { plugins: [router] } })
  await flushPromises()
  return { router, list, onReset, positionBefore }
}

const query = (router: Router) => router.currentRoute.value.query

describe('useListState', () => {
  it('parses the address into typed state', async () => {
    const { list } = await setup(
      '/keys?owner=alice&status=expired&event=signIn&event=signOut&sort=name&order=desc&page=3&size=50',
    )
    expect(list.state.value).toEqual({
      filters: { owner: 'alice', status: 'expired', event: ['signIn', 'signOut'] },
      sort: 'name',
      order: 'desc',
      page: 3,
      size: 50,
    })
  })

  it('falls back to defaults for invalid values and normalises the address with replace', async () => {
    const { list, router, positionBefore } = await setup(
      '/keys?status=bogus&size=30&page=-2&sort=evil&order=up&event=nope&owner=' +
        'x'.repeat(256) +
        '&junk=1',
    )
    expect(list.state.value).toEqual({
      filters: { owner: undefined, status: undefined, event: [] },
      sort: 'createdAt',
      order: 'desc',
      page: 1,
      size: 25,
    })
    expect(query(router)).toEqual({})
    // Normalisation replaced the entry instead of adding one.
    expect(router.options.history.state.position).toBe(positionBefore)
  })

  it('omits defaults from the address', async () => {
    const { list, router } = await setup('/keys?sort=createdAt&order=desc&page=1&size=25')
    expect(query(router)).toEqual({})
    await list.setSort('name')
    expect(query(router)).toEqual({ sort: 'name' })
    await list.setSort('name', 'desc')
    expect(query(router)).toEqual({ sort: 'name', order: 'desc' })
  })

  it('limits the page size to 25, 50 or 100', async () => {
    const { list, router } = await setup('/keys')
    await list.setSize(100)
    expect(list.state.value.size).toBe(100)
    expect(query(router)).toEqual({ size: '100' })
    await list.setSize(7 as 25)
    expect(list.state.value.size).toBe(25)
    expect(list.pageSizes).toEqual([25, 50, 100])
  })

  it('resets the page and calls onReset when filters, sort or size change', async () => {
    const { list, router, onReset } = await setup('/keys?page=4')
    await list.setFilter('status', 'active')
    expect(list.state.value.page).toBe(1)
    expect(query(router)).toEqual({ status: 'active' })
    expect(onReset).toHaveBeenCalledTimes(1)
    await list.setPage(3)
    await list.setSort('expiresAt')
    expect(list.state.value.page).toBe(1)
    await list.setPage(2)
    await list.setSize(50)
    expect(list.state.value.page).toBe(1)
    expect(onReset.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('uses push for explicit changes and replace for typing', async () => {
    const { list, router } = await setup('/keys')
    const push = vi.spyOn(router, 'push')
    const replace = vi.spyOn(router, 'replace')
    await list.setFilter('status', 'revoked')
    expect(push).toHaveBeenCalledTimes(1)
    await list.setFilter('owner', 'ali', { typing: true })
    expect(replace).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledTimes(1)
    await list.setPage(2)
    expect(push).toHaveBeenCalledTimes(2)
    expect(query(router)).toEqual({ status: 'revoked', owner: 'ali', page: '2' })
  })

  it('maps the state to limit and offset', async () => {
    const { list } = await setup('/keys?page=3&size=50&sort=name')
    expect(list.paging.value).toEqual({ limit: 50, offset: 100, sort: 'name', order: 'asc' })
  })

  it('clears a filter and lists the active ones', async () => {
    const { list, router } = await setup('/keys?owner=bob&event=signIn')
    expect(list.activeFilters.value).toEqual(['owner', 'event'])
    await list.setFilter('owner', undefined)
    await list.setFilter('event', [])
    expect(query(router)).toEqual({})
    await list.setFilters({ status: 'active', owner: 'carol' })
    expect(query(router)).toEqual({ owner: 'carol', status: 'active' })
  })

  it('writes nothing to storage', async () => {
    const local = vi.spyOn(Storage.prototype, 'setItem')
    const { list } = await setup('/keys?status=active')
    await list.setFilter('owner', 'someone')
    await list.setPage(2)
    expect(local).not.toHaveBeenCalled()
  })
})
