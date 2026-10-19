// UI 006 T083 (research R19, data-model §6 "Lists panel"): the Allowlist and the Denylist keep their
// state under prefixed address keys, the `list` switch is read and written on the address keeping
// every other key, and the requests of a page put the own entries first across pages.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { pageRequests, useListSwitch, usePolicyListState } from '@/features/spam-filter/lists-state'

import { mountWithApp } from '../../support/mount'

function setup(path: string) {
  const exposed: {
    allow?: ReturnType<typeof usePolicyListState>
    block?: ReturnType<typeof usePolicyListState>
    switcher?: ReturnType<typeof useListSwitch>
  } = {}
  const Host = defineComponent({
    setup() {
      exposed.allow = usePolicyListState('allow')
      exposed.block = usePolicyListState('block')
      exposed.switcher = useListSwitch()
      return () => h('div')
    },
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/spam-filter', component: Host }],
  })
  return {
    router,
    exposed,
    mount: async () => {
      await router.push(path)
      await router.isReady()
      mountWithApp(Host, { global: { plugins: [router] } })
      await flushPromises()
    },
  }
}

describe('usePolicyListState and useListSwitch', () => {
  it('reads each list from its prefixed keys and the switch from `list`', async () => {
    const { router, exposed, mount } = setup(
      '/spam-filter?list=block&allowQ=spam&allowSort=createdAt&blockPage=2&blockSize=50&edit=x',
    )
    await mount()
    expect(exposed.allow!.state.value).toMatchObject({
      filters: { q: 'spam' },
      sort: 'createdAt',
      order: 'desc',
      page: 1,
      size: 25,
    })
    expect(exposed.block!.state.value).toMatchObject({
      filters: { q: undefined },
      sort: 'pattern',
      order: 'asc',
      page: 2,
      size: 50,
    })
    expect(exposed.switcher!.list.value).toBe('block')
    expect(router.currentRoute.value.query).toEqual({
      list: 'block',
      allowQ: 'spam',
      allowSort: 'createdAt',
      blockPage: '2',
      blockSize: '50',
      edit: 'x',
    })
  })

  it('drops an invalid or default switch value and keeps the other keys', async () => {
    const { router, exposed, mount } = setup('/spam-filter?list=junk&allowQ=a#spam-filter')
    await mount()
    expect(exposed.switcher!.list.value).toBe('allow')
    expect(router.currentRoute.value.query).toEqual({ allowQ: 'a' })
    expect(router.currentRoute.value.hash).toBe('#spam-filter')
  })

  it('writes the switch without touching the lists, and omits the default', async () => {
    const { router, exposed, mount } = setup('/spam-filter?blockQ=x&allowPage=3')
    await mount()
    await exposed.switcher!.setList('block')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ blockQ: 'x', allowPage: '3', list: 'block' })
    await exposed.switcher!.setList('allow')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ blockQ: 'x', allowPage: '3' })
  })

  it('changes one list without resetting the other', async () => {
    const { router, exposed, mount } = setup('/spam-filter?blockPage=2')
    await mount()
    await exposed.allow!.setFilter('q', 'news')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ blockPage: '2', allowQ: 'news' })
  })
})

describe('pageRequests', () => {
  const state = {
    filters: { q: 'x' },
    sort: 'pattern' as const,
    order: 'asc' as const,
    page: 1,
    size: 25 as const,
  }

  it('asks for the own entries of the page and the inherited ones that follow them', () => {
    expect(pageRequests('block', state, undefined)).toEqual({
      own: {
        list: 'block',
        ownership: 'own',
        q: 'x',
        sort: 'pattern',
        order: 'asc',
        limit: 25,
        offset: 0,
      },
      inherited: null,
    })
    // 30 own entries: page 2 shows own 26-30, then inherited 1-20.
    expect(pageRequests('block', { ...state, page: 2 }, 30).inherited).toEqual({
      list: 'block',
      ownership: 'inherited',
      q: 'x',
      sort: 'pattern',
      order: 'asc',
      limit: 25,
      offset: 0,
    })
    // Page 3 starts at entry 51: inherited 21 onwards.
    expect(pageRequests('block', { ...state, page: 3 }, 30).inherited?.offset).toBe(20)
  })

  it('leaves out an empty search', () => {
    const request = pageRequests('allow', { ...state, filters: { q: undefined } }, 0)
    expect(request.own).not.toHaveProperty('q')
    expect(request.inherited).not.toHaveProperty('q')
  })
})
