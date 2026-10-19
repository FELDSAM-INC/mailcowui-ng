// The shared copy button (UI 010 T013, research R6, FR-074, FR-075): it copies exactly the given
// text, says so with the classic interface's message and keeps the "copied" state while it has the
// focus or the pointer; when the browser refuses, it selects the value in place and says so.
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import CopyButton from '@/shared/components/CopyButton.vue'
import { liveMessages } from '@/shared/composables/useAnnouncer'

import { mountWithApp } from '../../support/mount'

function stubClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value })
}

/** A value element and its copy button, as RecordValue renders them. */
const Host = defineComponent({
  props: { text: { type: String, required: true } },
  setup(props) {
    const target = ref<HTMLElement | null>(null)
    return () =>
      h('div', [
        h('code', { ref: target, id: 'value' }, props.text),
        h(CopyButton, {
          text: props.text,
          label: 'Copy record value of example.org',
          selectTarget: target.value,
        }),
      ])
  },
})

describe('CopyButton', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('copies exactly the text, is named by its label and announces the classic message', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    stubClipboard({ writeText })
    const text = 'v=DKIM1;k=rsa;t=s;s=email;p=MIIBIjAN'
    const wrapper = mountWithApp(Host, { props: { text }, attachTo: document.body })
    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('Copy record value of example.org')
    expect(button.text()).toContain('Copy')
    expect(button.classes()).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11']))
    await button.trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(text)
    expect(wrapper.get('[role="status"]').text()).toBe('Text copied to clipboard!')
    vi.advanceTimersByTime(60)
    expect(liveMessages.polite.value).toBe('Text copied to clipboard!')
    expect(button.attributes('data-copied')).toBeDefined()
    wrapper.unmount()
  })

  it('keeps the copied state while focused or hovered and reverts 2 s after it leaves', async () => {
    stubClipboard({ writeText: () => Promise.resolve() })
    const wrapper = mountWithApp(Host, { props: { text: 'abc' }, attachTo: document.body })
    const button = wrapper.get('button')
    await button.trigger('focus')
    await button.trigger('click')
    await flushPromises()
    vi.advanceTimersByTime(5000)
    await flushPromises()
    expect(button.attributes('data-copied')).toBeDefined()
    await button.trigger('pointerenter')
    await button.trigger('blur')
    vi.advanceTimersByTime(5000)
    await flushPromises()
    expect(button.attributes('data-copied')).toBeDefined()
    await button.trigger('pointerleave')
    vi.advanceTimersByTime(1900)
    await flushPromises()
    expect(button.attributes('data-copied')).toBeDefined()
    vi.advanceTimersByTime(200)
    await flushPromises()
    expect(button.attributes('data-copied')).toBeUndefined()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('selects the value in place with a message when the browser refuses', async () => {
    stubClipboard({
      writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')),
    })
    const wrapper = mountWithApp(Host, { props: { text: 'p=MIIB' }, attachTo: document.body })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toContain('did not allow copying')
    expect(window.getSelection()?.toString()).toBe('p=MIIB')
    expect(document.activeElement?.id).toBe('value')
    wrapper.unmount()
  })

  it('treats a browser without the clipboard API as a refusal', async () => {
    stubClipboard(undefined)
    const wrapper = mountWithApp(Host, { props: { text: 'x' }, attachTo: document.body })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
