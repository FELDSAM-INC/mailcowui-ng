import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import DataCard from '@/shared/components/DataCard.vue'
import { mountWithApp } from '../../support/mount'

function mountCard(details = false) {
  const router = createRouter({ history: createMemoryHistory(), routes: [] })
  return mountWithApp(DataCard, {
    props: { title: 'alice@example.org', to: '/mailboxes/alice', detailsLabel: 'Details of Alice' },
    slots: {
      select: '<input type="checkbox" aria-label="Select Alice" />',
      actions: '<button aria-label="Actions for Alice">Actions</button>',
      default: '<dl><dt>Messages</dt><dd>12</dd></dl>',
      ...(details ? { details: '<p>Last login yesterday</p>' } : {}),
    },
    global: { plugins: [router] },
  })
}

describe('DataCard', () => {
  it('keeps selection, linked identity and actions in the same header without an empty footer', () => {
    const card = mountCard()
    const header = card.get('[data-card-header]')
    expect(header.get('input').attributes('aria-label')).toBe('Select Alice')
    expect(header.get('h3 a').attributes('href')).toBe('/mailboxes/alice')
    expect(header.get('button').attributes('aria-label')).toBe('Actions for Alice')
    expect(card.text()).toContain('Messages12')
    expect(card.find('[data-card-expand]').exists()).toBe(false)
  })

  it('reveals optional details from one labelled bottom control, independently of row actions', async () => {
    const card = mountCard(true)
    const toggle = card.get('[data-card-expand]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(card.text()).not.toContain('Last login')
    await card.get('[data-card-actions] button').trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(card.get('[data-card-details]').attributes('id')).toBe(
      toggle.attributes('aria-controls'),
    )
    expect(card.text()).toContain('Last login yesterday')
    await toggle.trigger('click')
    expect(card.find('[data-card-details]').exists()).toBe(false)
  })
})
