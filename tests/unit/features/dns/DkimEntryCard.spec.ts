// A DKIM entry as a card and as a table row (T035, FR-006, FR-007, FR-083): the readable name with
// the ASCII form, the kind ("Alias domain" with its target), the state, the selector and the key
// length; sortable table headers with aria-sort.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent } from 'vue'

import DkimEntryCard from '@/features/dns/components/DkimEntryCard.vue'
import DkimEntryTable from '@/features/dns/components/DkimEntryTable.vue'

import { mountWithApp } from '../../support/mount'
import { aliasEntry, dkimEntry, missingEntry, unusedEntry } from './fixtures'

const Stub = defineComponent({ render: () => null })
const router = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Stub },
      { path: '/dns/dkim-keys/:dkimName', name: 'dkim-key', component: Stub },
    ],
  })

describe('DkimEntryCard', () => {
  it('is a list item named by its heading with every FR-006 value', async () => {
    const entry = dkimEntry({
      name: 'xn--bcher-kva.example',
      displayName: 'bücher.example',
      key: { ...dkimEntry().key!, keyLength: 1024 },
    })
    const wrapper = mountWithApp(DkimEntryCard, {
      props: { entry },
      global: { plugins: [router()] },
    })
    await flushPromises()
    expect(wrapper.element.tagName).toBe('LI')
    const heading = wrapper.get('h3')
    expect(heading.text()).toContain('bücher.example')
    expect(heading.text()).toContain('xn--bcher-kva.example')
    expect(heading.get('a').attributes('href')).toBe('/dns/dkim-keys/xn--bcher-kva.example')
    expect(wrapper.text()).toContain('Domain')
    expect(wrapper.text()).toContain('Key valid')
    expect(wrapper.text()).toContain('Selector')
    expect(wrapper.text()).toContain('dkim')
    expect(wrapper.text()).toContain('1,024')
  })

  it('names the target of an alias domain and leaves values of a missing key empty', () => {
    const alias = mountWithApp(DkimEntryCard, {
      props: { entry: aliasEntry() },
      global: { plugins: [router()] },
    })
    expect(alias.text()).toContain('Alias domain')
    expect(alias.text()).toContain('example.org')
    const missing = mountWithApp(DkimEntryCard, {
      props: { entry: missingEntry() },
      global: { plugins: [router()] },
    })
    expect(missing.text()).toContain('Key missing')
    expect(missing.text()).not.toContain('2,048')
    const unused = mountWithApp(DkimEntryCard, {
      props: { entry: unusedEntry() },
      global: { plugins: [router()] },
    })
    expect(unused.text()).toContain('No domain')
  })

  it('emits a selector filter', async () => {
    const wrapper = mountWithApp(DkimEntryCard, {
      props: { entry: dkimEntry() },
      global: { plugins: [router()] },
    })
    await wrapper.get('[data-filter-selector]').trigger('click')
    expect(wrapper.emitted('filterSelector')?.[0]).toEqual(['dkim'])
  })
})

describe('DkimEntryTable', () => {
  it('has sortable headers with aria-sort and one row per entry', async () => {
    const wrapper = mountWithApp(DkimEntryTable, {
      props: {
        entries: [dkimEntry(), missingEntry()],
        sort: 'name',
        order: 'asc',
        selectable: false,
      },
      global: { plugins: [router()] },
    })
    await flushPromises()
    const headers = wrapper.findAll('th')
    expect(headers.map((th) => th.attributes('scope'))).toEqual(headers.map(() => 'col'))
    const name = headers.find((th) => th.text().includes('Domain'))!
    expect(name.attributes('aria-sort')).toBe('ascending')
    const selector = headers.find((th) => th.text().includes('Selector'))!
    expect(selector.attributes('aria-sort')).toBe('none')
    await selector.get('button').trigger('click')
    expect(wrapper.emitted('sort')?.[0]).toEqual(['selector', 'asc'])
    await name.get('button').trigger('click')
    expect(wrapper.emitted('sort')?.[1]).toEqual(['name', 'desc'])
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('Key missing')
  })
})
