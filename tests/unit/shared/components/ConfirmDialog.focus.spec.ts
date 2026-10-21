import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import { confirm, settleConfirm } from '@/shared/composables/useConfirm'
import { mountWithApp } from '../../support/mount'

// Control the close-autofocus boundary so the caller can reenable its trigger after the event.
// Browser coverage exercises the real Reka focus scope and Escape path.
const Content = defineComponent({
  name: 'AlertDialogContent',
  emits: ['closeAutoFocus'],
  setup:
    (_, { slots }) =>
    () =>
      h('div', { role: 'alertdialog', tabindex: -1 }, slots.default?.()),
})
const mounted: { unmount(): void }[] = []
afterEach(() => {
  settleConfirm(false)
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
})
async function open() {
  const trigger = document.createElement('button')
  trigger.textContent = 'Save'
  document.body.append(trigger)
  const wrapper = mountWithApp(ConfirmDialog, {
    attachTo: document.body,
    global: {
      stubs: {
        AlertDialogContent: Content,
        AlertDialogCancel: { template: '<button><slot /></button>' },
      },
    },
  })
  mounted.push(wrapper)
  trigger.focus()
  void confirm({ title: 'Restart service?', confirmLabel: 'Save' })
  await flushPromises()
  trigger.disabled = true
  const content = wrapper.findComponent(Content)
  ;(content.element as HTMLElement).focus()
  return { wrapper, content, trigger }
}

describe('ConfirmDialog focus', () => {
  it('brings a focused action into the dialog viewport on a short screen', async () => {
    const { content } = await open()
    const cancel = content.get<HTMLButtonElement>('button')
    vi.spyOn(content.element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 16, 320, 193))
    vi.spyOn(cancel.element, 'getBoundingClientRect').mockReturnValue(new DOMRect(24, 357, 272, 44))
    const scroll = vi.fn()
    Object.defineProperty(cancel.element, 'scrollIntoView', { value: scroll })
    cancel.element.focus()
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
  })

  it('waits for the caller to reenable the trigger before restoring focus', async () => {
    const { content, trigger } = await open()
    settleConfirm(false)
    content.vm.$emit('closeAutoFocus', new Event('closeAutoFocus', { cancelable: true }))
    trigger.disabled = false
    await flushPromises()
    expect(document.activeElement).toBe(trigger)
  })

  it('preserves an intentional focus move while the dialog closes', async () => {
    const { content, trigger } = await open()
    const outside = document.createElement('button')
    document.body.append(outside)
    settleConfirm(false)
    content.vm.$emit('closeAutoFocus', new Event('closeAutoFocus', { cancelable: true }))
    trigger.disabled = false
    outside.focus()
    await flushPromises()
    expect(document.activeElement).toBe(outside)
  })
})
