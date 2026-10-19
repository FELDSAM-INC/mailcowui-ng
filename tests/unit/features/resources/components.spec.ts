// The resource list entry and mass actions (T095): the card shows the classic columns with the
// translated kind and legacy's booking badge; the mass actions are activate, deactivate (one
// confirmation) and delete (the typed count); the entry menu offers Edit and Remove.
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import ResourceCard from '@/features/resources/components/ResourceCard.vue'
import ResourceEntryActions from '@/features/resources/components/ResourceEntryActions.vue'
import { resourceBulkActions } from '@/features/resources/resource-bulk'
import { loadLegacy, resetLegacy } from '@/i18n/legacy'

import { mountWithApp } from '../../support/mount'
import { resource } from './resource-fixture'

const router = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { render: () => null } },
      {
        path: '/resources/:resourceAddress',
        name: 'resource-detail',
        component: { render: () => null },
      },
    ],
  })

beforeEach(async () => {
  await loadLegacy('en-gb')
})
afterEach(() => resetLegacy())

describe('ResourceCard', () => {
  it('shows the description, address, kind, domain, booking badge and active state', () => {
    const wrapper = mountWithApp(ResourceCard, {
      props: { resource: resource({ bookingRule: 'limited', bookingLimit: 2 }) },
      global: { plugins: [router()] },
    })
    const text = wrapper.text()
    expect(text).toContain('Meeting Room 1')
    expect(text).toContain('MeetingRoom1@example.org')
    expect(text).toContain('Location')
    expect(text).toContain('example.org')
    expect(text).toContain('Hard limit (2)')
    expect(wrapper.find('[data-entry="MeetingRoom1@example.org"]').exists()).toBe(true)
  })
})

describe('resourceBulkActions', () => {
  it("offers legacy's three actions with their confirmations", () => {
    expect(
      resourceBulkActions().map((action) => [action.action, action.labelKey, action.confirm]),
    ).toEqual([
      ['activate', 'mailbox.activate', 'none'],
      ['deactivate', 'mailbox.deactivate', 'simple'],
      ['delete', 'mailbox.remove', 'typedCount'],
    ])
  })
})

describe('ResourceEntryActions', () => {
  async function openMenu() {
    const testRouter = router()
    await testRouter.push('/')
    const wrapper = mountWithApp(ResourceEntryActions, {
      props: { resource: resource() },
      global: { plugins: [testRouter] },
      attachTo: document.body,
    })
    const trigger = wrapper.get('button')
    expect(trigger.attributes('aria-label')).toBe('Actions for Meeting Room 1')
    await trigger.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    return { wrapper, router: testRouter, items }
  }

  it('offers Edit, which opens the resource with its section open', async () => {
    const { wrapper, router: testRouter, items } = await openMenu()
    expect(items.map((item) => item.textContent?.trim())).toEqual(['Edit', 'Remove'])
    items[0]!.click()
    await vi.waitFor(() =>
      expect(testRouter.currentRoute.value.fullPath).toBe(
        '/resources/MeetingRoom1@example.org?edit=resource',
      ),
    )
    wrapper.unmount()
  })

  it('emits the deletion once the menu has closed', async () => {
    const { wrapper, items } = await openMenu()
    items[1]!.click()
    await vi.waitFor(() => expect(wrapper.emitted('delete')).toHaveLength(1))
    wrapper.unmount()
  })
})
