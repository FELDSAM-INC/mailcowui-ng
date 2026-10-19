// The actions of an alias entry (FR-015, FR-031; `draw_alias_table()`'s action column): a menu named
// after the alias with Edit, which opens the alias with its section open, "Expand alias over alias
// domains" only for an alias of a primary domain that is not orphaned, and Remove; the copy and the
// deletion are emitted once the menu has closed.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { Alias } from '@/api'
import AliasEntryActions from '@/features/aliases/components/AliasEntryActions.vue'

import { mountWithApp } from '../../support/mount'
import { alias } from './alias-fixture'

async function openMenu(value: Alias) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { render: () => null } },
      { path: '/aliases/:aliasId', name: 'alias-detail', component: { render: () => null } },
    ],
  })
  await router.push('/')
  const wrapper = mountWithApp(AliasEntryActions, {
    props: { alias: value },
    global: { plugins: [router] },
    attachTo: document.body,
  })
  const trigger = wrapper.get('button')
  expect(trigger.attributes('aria-label')).toBe(`Actions for ${value.addressUnicode}`)
  await trigger.trigger('keydown', { key: 'Enter' })
  await flushPromises()
  const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
  return { wrapper, router, items }
}

const labels = (items: HTMLElement[]) => items.map((item) => item.textContent?.trim())

describe('AliasEntryActions', () => {
  it('offers Edit, which opens the alias with its section open', async () => {
    const { wrapper, router, items } = await openMenu(alias())
    expect(labels(items)).toEqual(['Edit', 'Expand alias over alias domains', 'Remove'])
    items[0]!.click()
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/aliases/7?edit=alias'))
    wrapper.unmount()
  })

  it('emits the copy and the deletion once the menu has closed', async () => {
    const first = await openMenu(alias())
    first.items[1]!.click()
    await vi.waitFor(() => expect(first.wrapper.emitted('copy')).toHaveLength(1))
    expect(first.wrapper.emitted('delete')).toBeUndefined()
    first.wrapper.unmount()
    const second = await openMenu(alias())
    second.items[2]!.click()
    await vi.waitFor(() => expect(second.wrapper.emitted('delete')).toHaveLength(1))
    second.wrapper.unmount()
  })

  it('offers no expansion for an alias of an alias domain or an orphaned alias', async () => {
    const inAliasDomain = await openMenu(
      alias({
        address: 'info@example.net',
        addressUnicode: 'info@example.net',
        inAliasDomain: true,
      }),
    )
    expect(labels(inAliasDomain.items)).toEqual(['Edit', 'Remove'])
    inAliasDomain.wrapper.unmount()
    const orphaned = await openMenu(alias({ orphaned: true }))
    expect(labels(orphaned.items)).toEqual(['Edit', 'Remove'])
    orphaned.wrapper.unmount()
  })
})
