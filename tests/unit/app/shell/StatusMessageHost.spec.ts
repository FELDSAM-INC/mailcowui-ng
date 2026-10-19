// UI 011 (research R8, FR-078, T022): app-level status messages stay until dismissed (never on a
// timer), stack, and move the focus sensibly when dismissed; the shell's status region holds them.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import StatusMessageHost from '@/app/shell/StatusMessageHost.vue'
import {
  clearStatusMessages,
  pushStatusMessage,
  useStatusMessage,
} from '@/shared/composables/useStatusMessage'

import { mountWithApp } from '../../support/mount'

afterEach(() => {
  clearStatusMessages()
  vi.useRealTimers()
})

describe('StatusMessageHost', () => {
  it('shows pushed messages in a status region until they are dismissed', async () => {
    vi.useFakeTimers()
    const wrapper = mountWithApp(StatusMessageHost, { attachTo: document.body })
    pushStatusMessage({ text: 'sogo-mailcow: OK', tone: 'success' })
    pushStatusMessage({ text: 'Error: refused', tone: 'danger' })
    await nextTick()
    expect(wrapper.attributes('data-status-list')).toBeDefined()
    expect(wrapper.findAll('[data-status-message]').map((item) => item.text())).toEqual([
      'sogo-mailcow: OK',
      'Error: refused',
    ])
    vi.advanceTimersByTime(10 * 60_000)
    await nextTick()
    expect(wrapper.findAll('[data-status-message]')).toHaveLength(2)
    wrapper.unmount()
  })

  it('moves the focus to the next message, then to the main content', async () => {
    const main = document.createElement('main')
    main.id = 'main'
    main.tabIndex = -1
    document.body.append(main)
    const wrapper = mountWithApp(StatusMessageHost, { attachTo: document.body })
    const { push, messages } = useStatusMessage()
    push({ text: 'first', tone: 'info' })
    push({ text: 'second', tone: 'warning' })
    await nextTick()
    const buttons = wrapper.findAll('[data-dismiss]')
    expect(buttons[0]!.attributes('aria-label')).toBe('Close')
    await buttons[0]!.trigger('click')
    await nextTick()
    await nextTick()
    expect(messages.value.map((message) => message.text)).toEqual(['second'])
    expect(document.activeElement?.hasAttribute('data-dismiss')).toBe(true)
    await wrapper.find('[data-dismiss]').trigger('click')
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(main)
    wrapper.unmount()
  })
})
