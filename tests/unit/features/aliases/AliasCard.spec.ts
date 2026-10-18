// An alias as a card and its badges (T033, FR-012, FR-015, FR-063): the classic columns as labelled
// values, the Catch-All badge, orphaned for administrators only, booleans as text, the groupware
// value only with the groupware, and a menu slot.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import AliasBadges from '@/features/aliases/components/AliasBadges.vue'
import AliasCard from '@/features/aliases/components/AliasCard.vue'
import { loadLegacy, resetLegacy } from '@/i18n/legacy'

import { mountWithApp } from '../../support/mount'
import { alias } from './alias-fixture'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { render: () => null } },
    { path: '/aliases/:aliasId', name: 'alias-detail', component: { render: () => null } },
  ],
})

beforeEach(async () => {
  await loadLegacy('en-gb')
})
afterEach(() => resetLegacy())

describe('AliasBadges', () => {
  it('shows Catch-All, and orphaned only to those who may see it', () => {
    const catchAll = mountWithApp(AliasBadges, {
      props: { alias: alias({ kind: 'catchAll', address: '@example.org' }), canSeeOrphaned: false },
    })
    expect(catchAll.get('[data-badge="catchAll"]').text()).toBe('Catch-All')
    const orphaned = alias({ orphaned: true })
    expect(
      mountWithApp(AliasBadges, { props: { alias: orphaned, canSeeOrphaned: true } })
        .find('[data-badge="orphaned"]')
        .exists(),
    ).toBe(true)
    expect(
      mountWithApp(AliasBadges, { props: { alias: orphaned, canSeeOrphaned: false } }).html(),
    ).not.toContain('orphaned')
  })
})

describe('AliasCard', () => {
  it('links the address to the alias page and shows the classic columns as text', () => {
    const wrapper = mountWithApp(AliasCard, {
      props: {
        alias: alias({
          inAliasDomain: true,
          domain: 'example.net',
          domainUnicode: 'example.net',
          active: false,
          publicComment: 'Sales team',
        }),
        groupwareEnabled: true,
        canSeeOrphaned: true,
      },
      slots: { actions: () => h('button', { class: 'menu' }, 'menu') },
      global: { plugins: [router] },
    })
    expect(wrapper.get('h3 a').attributes('href')).toBe('/aliases/7')
    expect(wrapper.text()).toContain('Goto address')
    expect(wrapper.text()).toContain('anna@example.org')
    expect(wrapper.text()).toContain('Target domain: example.org')
    expect(wrapper.text()).toContain('Sales team')
    expect(wrapper.get('[data-field="active"]').text()).toContain('No')
    expect(wrapper.find('[data-field="groupwareVisible"]').exists()).toBe(true)
    expect(wrapper.find('.menu').exists()).toBe(true)
  })

  it('has no groupware value while the groupware is disabled or unknown', () => {
    for (const groupwareEnabled of [false, undefined]) {
      const wrapper = mountWithApp(AliasCard, {
        props: { alias: alias(), groupwareEnabled, canSeeOrphaned: false },
        global: { plugins: [router] },
      })
      expect(wrapper.find('[data-field="groupwareVisible"]').exists()).toBe(false)
    }
  })
})
