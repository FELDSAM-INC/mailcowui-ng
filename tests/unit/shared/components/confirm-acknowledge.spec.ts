// UI 006 (FR-026, FR-034): a high-risk confirmation keeps its confirm action disabled until the
// acknowledgement is ticked; the tick does not survive into the next confirmation.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import { settleConfirm, useConfirm } from '@/shared/composables/useConfirm'

import { mountWithApp } from '../../support/mount'

const mounted: { unmount(): void }[] = []

function mountHost() {
  let confirm!: ReturnType<typeof useConfirm>
  const Host = defineComponent({
    setup() {
      confirm = useConfirm()
      return () => h('div', [h(ConfirmDialog)])
    },
  })
  mounted.push(mountWithApp(Host, { attachTo: document.body }))
  return () => confirm
}

const deliver = () =>
  [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find(
    (button) => button.textContent?.trim() === 'Deliver',
  )!
const checkbox = () =>
  document.querySelector<HTMLInputElement>('[role="alertdialog"] [data-acknowledge] input')!

afterEach(() => {
  settleConfirm(false)
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})

describe('ConfirmDialog with an acknowledgement', () => {
  it('enables confirm only while the acknowledgement is ticked', async () => {
    const confirm = mountHost()
    const answer = confirm()({
      title: 'Deliver to inbox',
      confirmLabel: 'Deliver',
      acknowledge: { label: 'I understand that this message contains a virus' },
    })
    await flushPromises()
    expect(checkbox().closest('label')!.textContent).toContain(
      'I understand that this message contains a virus',
    )
    expect(deliver().disabled).toBe(true)
    checkbox().click()
    await flushPromises()
    expect(deliver().disabled).toBe(false)
    checkbox().click()
    await flushPromises()
    expect(deliver().disabled).toBe(true)
    checkbox().click()
    await flushPromises()
    deliver().click()
    await expect(answer).resolves.toBe(true)
  })

  it('starts unticked for the next request', async () => {
    const confirm = mountHost()
    const first = confirm()({ title: 'A', confirmLabel: 'Deliver', acknowledge: { label: 'Ack' } })
    await vi.waitFor(() => expect(checkbox()).not.toBeNull())
    checkbox().click()
    await flushPromises()
    expect(deliver().disabled).toBe(false)
    // A new request replaces the open one (which resolves false).
    void confirm()({ title: 'B', confirmLabel: 'Deliver', acknowledge: { label: 'Ack' } })
    await expect(first).resolves.toBe(false)
    await flushPromises()
    expect(checkbox().checked).toBe(false)
    expect(deliver().disabled).toBe(true)
  })
})
