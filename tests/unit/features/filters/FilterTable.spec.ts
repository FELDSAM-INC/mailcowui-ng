import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import FilterTable from '@/features/filters/components/FilterTable.vue'
import { mockSieveFilter, sieveFilterView } from '../../../mocks/factories/sieve-filter'
import { mountWithApp } from '../../support/mount'
import { createTestRouter } from '../../support/router'

const item = sieveFilterView(
  mockSieveFilter({ id: 1, mailbox: 'anna@example.org', description: 'Spam rule' }),
)
function render(canChange = true) {
  return mountWithApp(FilterTable, {
    props: {
      items: [item],
      location: () => '/filters/1',
      selecting: false,
      selected: () => false,
      canSelect: () => true,
      canChange,
      busy: false,
    },
    global: { plugins: [createTestRouter()] },
    attachTo: document.body,
  })
}

describe('FilterTable row controls', () => {
  it('discloses the complete script from the last column and removes through its menu', async () => {
    const wrapper = render()
    const row = wrapper.get('[data-filter-id="1"]')
    const controls = row.findAll('td').at(-1)!
    const expand = controls.get('[data-row-expand]')
    expect(expand.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('pre').exists()).toBe(false)
    await expand.trigger('click')
    expect(expand.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('pre').text()).toContain(item.script)
    expect(
      wrapper.get(`tr[id="${expand.attributes('aria-controls')}"] td`).attributes('colspan'),
    ).toBe('5')
    await controls.get('[data-row-action-trigger]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    expect(items.map((action) => action.textContent?.trim())).toEqual(['Edit', 'Remove'])
    items[1]!.click()
    await vi.waitFor(() => expect(wrapper.emitted('remove')?.[0]).toEqual([item]))
    wrapper.unmount()
  })

  it('keeps the sole edit action direct for read-only users, with script disclosure available', () => {
    const wrapper = render(false)
    expect(wrapper.find('[data-row-action-trigger]').exists()).toBe(false)
    expect(wrapper.get('a').attributes('aria-label')).toBe('Edit: Spam rule')
    expect(wrapper.find('[data-row-expand]').exists()).toBe(true)
    wrapper.unmount()
  })
})
