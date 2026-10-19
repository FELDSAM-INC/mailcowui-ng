// UI 006 (T022, research R19): two lists on one page keep their state under prefixed address keys,
// reset only their own page, and leave each other's (and unprefixed) parameters alone.
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { text, useListState, type ListSchema } from '@/shared/composables/useListState'

type Filters = { q: string | undefined }
type Sort = 'pattern' | 'createdAt'
type Views = { inheritedPage: number }

const schema: ListSchema<Filters, Sort, Views> = {
  filters: { q: text({ maxLength: 255 }) },
  sort: {
    values: ['pattern', 'createdAt'],
    default: 'pattern',
    defaultOrder: (sort) => (sort === 'createdAt' ? 'desc' : 'asc'),
  },
  views: {
    inheritedPage: {
      parse: (raw) => {
        const value = Array.isArray(raw) ? raw[0] : raw
        return typeof value === 'string' && /^[1-9][0-9]*$/.test(value) ? Number(value) : 1
      },
      serialize: (value) => (value > 1 ? String(value) : undefined),
      isSet: (value) => value > 1,
    },
  },
}

async function setup(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/spam-filter', component: { render: () => null } }],
  })
  await router.push(path)
  await router.isReady()
  const resetAllow = vi.fn()
  const resetBlock = vi.fn()
  let allow!: ReturnType<typeof useListState<Filters, Sort, Views>>
  let block!: ReturnType<typeof useListState<Filters, Sort, Views>>
  mount(
    defineComponent({
      setup() {
        allow = useListState(schema, { prefix: 'allow', onReset: resetAllow })
        block = useListState(schema, { prefix: 'block', onReset: resetBlock })
        return () => h('div')
      },
    }),
    { global: { plugins: [router] } },
  )
  await flushPromises()
  return { router, allow, block, resetAllow, resetBlock }
}

describe('useListState with a key prefix', () => {
  it('reads each list from its own prefixed keys', async () => {
    const { allow, block, router } = await setup(
      '/spam-filter?list=block&allowQ=bank&allowPage=2&blockSort=createdAt&blockSize=50&blockInheritedPage=3',
    )
    expect(allow.state.value.filters.q).toBe('bank')
    expect(allow.state.value.page).toBe(2)
    expect(allow.state.value.sort).toBe('pattern')
    expect(block.state.value.filters.q).toBeUndefined()
    expect(block.state.value.sort).toBe('createdAt')
    expect(block.state.value.order).toBe('desc')
    expect(block.state.value.size).toBe(50)
    expect(block.views.value.inheritedPage).toBe(3)
    expect(block.paging.value).toEqual({ limit: 50, offset: 0, sort: 'createdAt', order: 'desc' })
    // Nothing was normalised away: the other list's keys and the unprefixed `list` stay.
    expect(router.currentRoute.value.query).toEqual({
      list: 'block',
      allowQ: 'bank',
      allowPage: '2',
      blockSort: 'createdAt',
      blockSize: '50',
      blockInheritedPage: '3',
    })
  })

  it('normalises only its own invalid keys', async () => {
    const { router } = await setup('/spam-filter?list=allow&allowPage=x&blockSort=nope&other=1')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ list: 'allow', other: '1' })
  })

  it('changes and resets only its own list', async () => {
    const { allow, block, router, resetAllow, resetBlock } = await setup(
      '/spam-filter?allowPage=2&blockPage=4&list=block',
    )
    await block.setFilter('q', 'spam')
    await flushPromises()
    expect(resetBlock).toHaveBeenCalledTimes(1)
    expect(resetAllow).not.toHaveBeenCalled()
    expect(router.currentRoute.value.query).toEqual({
      allowPage: '2',
      blockQ: 'spam',
      list: 'block',
    })
    expect(allow.state.value.page).toBe(2)
    await allow.setSort('createdAt')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({
      allowSort: 'createdAt',
      blockQ: 'spam',
      list: 'block',
    })
    await block.setView('inheritedPage', 2)
    await flushPromises()
    expect(router.currentRoute.value.query.blockInheritedPage).toBe('2')
    expect(router.currentRoute.value.query.allowSort).toBe('createdAt')
  })
})
