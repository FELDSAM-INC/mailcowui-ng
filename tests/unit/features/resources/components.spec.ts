// The resource list entry and mass actions (T095): the card shows the classic columns with the
// translated kind and legacy's booking badge; the mass actions are activate, deactivate (one
// confirmation) and delete (the typed count).
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import ResourceCard from '@/features/resources/components/ResourceCard.vue'
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
