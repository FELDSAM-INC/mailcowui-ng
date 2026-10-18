// The template list's address parameters (UI 002 T081, data-model §5, FR-049): parsed, normalised
// and mapped to the `listDomainTemplates` query.
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { componentsParametersDomainTemplateSortValues } from '@/api'
import { useTemplateListState } from '@/features/domains/templates-list-state'

async function setup(path: string) {
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/domain-templates', component: { render: () => null } }],
  })
  await router.push(path)
  let list!: ReturnType<typeof useTemplateListState>
  let resets = 0
  mount(
    defineComponent({
      setup() {
        list = useTemplateListState({ onReset: () => (resets += 1) })
        return () => h('div')
      },
    }),
    { global: { plugins: [router] } },
  )
  await flushPromises()
  return { router, list, resets: () => resets }
}

describe('template list state', () => {
  it('defaults to the first 25 by name, ascending', async () => {
    const { list } = await setup('/domain-templates')
    expect(list.params.value).toEqual({ limit: 25, offset: 0, sort: 'name', order: 'asc' })
    expect(list.hasSearch.value).toBe(false)
  })

  it('maps the search, sort, order, page and size', async () => {
    const { list } = await setup('/domain-templates?q=small&sort=id&order=desc&page=2&size=50')
    expect(list.params.value).toEqual({
      q: 'small',
      sort: 'id',
      order: 'desc',
      limit: 50,
      offset: 50,
    })
    expect(list.hasSearch.value).toBe(true)
  })

  it('offers exactly the sort keys of the contract', () => {
    expect([...componentsParametersDomainTemplateSortValues].sort()).toEqual(
      ['createdAt', 'id', 'modifiedAt', 'name'].sort(),
    )
  })

  it('replaces invalid values with the defaults', async () => {
    const { router, list } = await setup('/domain-templates?sort=nope&order=up&page=0&size=7')
    await flushPromises()
    expect(list.params.value).toEqual({ limit: 25, offset: 0, sort: 'name', order: 'asc' })
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('resets the selection when the search, sort, page or size change', async () => {
    const { list, resets } = await setup('/domain-templates')
    await list.setFilter('q', 'x')
    await list.setSort('id', 'asc')
    await list.setPage(2)
    expect(resets()).toBeGreaterThanOrEqual(3)
  })
})
