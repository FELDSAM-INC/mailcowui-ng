import { flushPromises } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { DropdownMenuContent as RekaContent } from 'reka-ui'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { mountWithApp } from '../../support/mount'

function mountMenu(options: { open?: boolean; forceMount?: boolean } = {}) {
  const open = ref(options.open ?? false)
  const selected = vi.fn()
  const wrapper = mountWithApp(
    defineComponent({
      setup: () => () =>
        h(
          DropdownMenu,
          { open: open.value, 'onUpdate:open': (value: boolean) => (open.value = value) },
          () => [
            h(DropdownMenuTrigger, { 'aria-label': 'Entry actions' }, () => 'Actions'),
            h(DropdownMenuContent, { forceMount: options.forceMount }, () =>
              h(DropdownMenuItem, { onSelect: selected }, () => 'Edit'),
            ),
          ],
        ),
    }),
    { attachTo: document.body },
  )
  return { wrapper, open, selected }
}

it('opens a cold menu with the keyboard and preserves its close/focus lifecycle', async () => {
  const { wrapper, open } = mountMenu()
  await flushPromises()
  expect(wrapper.findComponent(RekaContent).exists()).toBe(false)
  const trigger = wrapper.get('button')
  ;(trigger.element as HTMLButtonElement).focus()
  await trigger.trigger('keydown', { key: 'ArrowDown' })
  await vi.waitFor(() => expect(document.querySelector('[role="menuitem"]')).not.toBeNull())
  expect(open.value).toBe(true)
  const item = document.querySelector<HTMLElement>('[role="menuitem"]')!
  item.focus()
  item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await vi.waitFor(() => expect(open.value).toBe(false))
  await vi.waitFor(() => expect(document.activeElement).toBe(trigger.element))
  expect(wrapper.findComponent(RekaContent).exists()).toBe(true)
  await trigger.trigger('keydown', { key: 'Enter' })
  await vi.waitFor(() => expect(document.querySelector('[role="menuitem"]')).not.toBeNull())
  wrapper.unmount()
})

it.each([{ open: true }, { forceMount: true }])(
  'supports an initially mounted menu %j',
  async (options) => {
    const { wrapper } = mountMenu(options)
    await flushPromises()
    expect(wrapper.findComponent(RekaContent).exists()).toBe(true)
    wrapper.unmount()
  },
)
