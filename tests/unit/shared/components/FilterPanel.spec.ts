// UI 006 (T011, plan P24, research R12): the shared filter panel. From md up it is an inline panel
// below its toggle; below md the toggle opens a full-screen dialog. Both have "Apply filters" and
// "Clear all filters"; the toggle names the number of active filters, and opening tells the parent
// to start from the applied filters.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import FilterPanel from '@/shared/components/FilterPanel.vue'

import { installMatchMedia } from '../../support/media'
import { mountWithApp } from '../../support/mount'

afterEach(() => {
  vi.unstubAllGlobals()
})

function mountPanel(wide: boolean, activeCount = 0) {
  installMatchMedia({ '(min-width: 768px)': wide })
  const events: string[] = []
  const count = ref(activeCount)
  const Host = defineComponent({
    setup: () => () =>
      h(
        FilterPanel,
        {
          id: 'test-filters',
          activeCount: count.value,
          onOpen: () => events.push('open'),
          onApply: () => events.push('apply'),
          onClear: () => events.push('clear'),
        },
        { default: () => h('label', [h('span', 'Field'), h('input', { name: 'field' })]) },
      ),
  })
  const wrapper = mountWithApp(Host, { attachTo: document.body })
  const toggle = () => wrapper.get('button[data-filter-toggle]')
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
  const button = (root: ParentNode, name: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (item) => item.textContent?.trim() === name,
    )
  return { wrapper, events, count, toggle, dialog, button }
}

describe('FilterPanel', () => {
  it('names the active filters on its toggle', async () => {
    const { toggle, count } = mountPanel(true)
    expect(toggle().text()).toBe('Filters')
    count.value = 3
    await flushPromises()
    expect(toggle().text()).toBe('Filters (3)')
  })

  it('from md up: an inline panel that the toggle expands, with Apply and Clear all', async () => {
    const { wrapper, toggle, events, button } = mountPanel(true)
    const panel = () => wrapper.get('#test-filters')
    expect(toggle().attributes('aria-expanded')).toBe('false')
    expect(toggle().attributes('aria-controls')).toBe('test-filters')
    expect(panel().isVisible()).toBe(false)
    await toggle().trigger('click')
    expect(events).toEqual(['open'])
    expect(toggle().attributes('aria-expanded')).toBe('true')
    expect(panel().isVisible()).toBe(true)
    expect(panel().find('input[name="field"]').exists()).toBe(true)
    await panel().trigger('submit')
    button(panel().element, 'Clear all filters')!.click()
    expect(events).toEqual(['open', 'apply', 'clear'])
    expect(button(panel().element, 'Apply filters')!.type).toBe('submit')
    // The inline panel stays open after applying.
    expect(panel().isVisible()).toBe(true)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('opens inline when filters are active', () => {
    const { wrapper, toggle } = mountPanel(true, 2)
    expect(toggle().attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('#test-filters').isVisible()).toBe(true)
  })

  it('below md: a full-screen dialog titled "Filters" whose Apply applies and closes', async () => {
    const { toggle, dialog, events, button } = mountPanel(false)
    expect(toggle().attributes('aria-haspopup')).toBe('dialog')
    await toggle().trigger('click')
    await vi.waitFor(() => expect(dialog()).not.toBeNull())
    expect(events).toEqual(['open'])
    expect(dialog()!.getAttribute('aria-labelledby')).toBeTruthy()
    const title = document.getElementById(dialog()!.getAttribute('aria-labelledby')!)
    expect(title?.textContent?.trim()).toBe('Filters')
    expect(dialog()!.querySelector('input[name="field"]')).not.toBeNull()
    button(dialog()!, 'Apply filters')!.click()
    await vi.waitFor(() => expect(dialog()).toBeNull())
    expect(events).toEqual(['open', 'apply'])
  })

  it('below md: Clear all clears and closes; Escape closes without applying', async () => {
    const { toggle, dialog, events, button } = mountPanel(false)
    await toggle().trigger('click')
    await vi.waitFor(() => expect(dialog()).not.toBeNull())
    button(dialog()!, 'Clear all filters')!.click()
    await vi.waitFor(() => expect(dialog()).toBeNull())
    expect(events).toEqual(['open', 'clear'])
    await toggle().trigger('click')
    await vi.waitFor(() => expect(dialog()).not.toBeNull())
    dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => expect(dialog()).toBeNull())
    expect(events).toEqual(['open', 'clear', 'open'])
  })

  it('keeps Apply disabled while the parent reports invalid input', async () => {
    installMatchMedia({ '(min-width: 768px)': true })
    const wrapper = mountWithApp(FilterPanel, {
      props: { id: 'x', activeCount: 0, applyDisabled: true },
      slots: { default: () => h('span', 'fields') },
    })
    await wrapper.get('button[data-filter-toggle]').trigger('click')
    const apply = wrapper.findAll('button').find((item) => item.text() === 'Apply filters')!
    expect(apply.attributes('disabled')).toBeDefined()
    await wrapper.get('#x').trigger('submit')
    expect(wrapper.emitted('apply')).toBeUndefined()
  })
})
