import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import {
  useNotificationEditor,
  type NotificationField,
} from '@/features/quarantine/composables/useNotificationEditor'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

async function setup(canChange = (_field: NotificationField) => true) {
  useScenario('quarantine-mailbox-user')
  let editor!: ReturnType<typeof useNotificationEditor>
  const wrapper = mountWithApp(
    defineComponent({
      setup() {
        editor = useNotificationEditor({ mailbox: () => 'alice@example.org', canChange })
        return () => h('div')
      },
    }),
  )
  editor.open()
  await flushPromises()
  await vi.waitFor(() => expect(editor.base.value).not.toBeNull())
  return { editor, wrapper }
}
const writes = () =>
  mockState().requests.filter(
    (r) => r.operationId === 'updateMailboxQuarantineNotificationSettings',
  )

describe('notification editor', () => {
  it('accepts a late read and sends only the chosen field with its own version', async () => {
    const { editor, wrapper } = await setup()
    const before = editor.base.value!
    expect(before).toBeTruthy()
    editor.choose('frequency', 'weekly')
    expect(editor.dirty()).toBe(true)
    expect(await editor.save()).toBe('saved')
    expect(writes()[0]!.body).toEqual({ frequency: 'weekly' })
    expect(writes()[0]!.headers['if-match']).toBe(before.etag)
    expect(editor.dirty()).toBe(false)
    wrapper.unmount()
  })
  it('keeps independently denied fields out of the patch', async () => {
    const { editor, wrapper } = await setup((field) => field === 'category')
    editor.choose('frequency', 'weekly')
    editor.choose('category', 'all')
    expect(await editor.save()).toBe('saved')
    expect(writes()[0]!.body).toEqual({ category: 'all' })
    wrapper.unmount()
  })
  it('preserves a chosen value after 412 and requires an explicit second save with a fresh version', async () => {
    const { editor, wrapper } = await setup()
    editor.choose('frequency', 'weekly')
    mockState().mailboxes.find(
      (m) => m.localPart === 'alice' && m.domain === 'example.org',
    )!.quarantineNotification = 'never'
    expect(await editor.save()).toBe('outdated')
    expect(editor.frequency.value).toBe('weekly')
    expect(editor.changes.value).toContainEqual(
      expect.objectContaining({ field: 'quarantine-frequency' }),
    )
    expect(writes()).toHaveLength(1)
    expect(await editor.save()).toBe('saved')
    expect(writes()).toHaveLength(2)
    expect(writes()[1]!.headers['if-match']).not.toBe(writes()[0]!.headers['if-match'])
    wrapper.unmount()
  })
})
