// T104: renaming (FR-054): 1–255 characters after trimming, messages on the field, and the input
// kept after a 412.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import RenamePasskeyDialog from '@/features/passkeys/components/RenamePasskeyDialog.vue'

import { alicePasskeys } from '../../../mocks/scenarios/passkeys'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

const phone = alicePasskeys()[0]!
const passkey = (({ credentialId: _c, ...rest }) => rest)(phone)

async function mountDialog() {
  const wrapper = mountWithApp(RenamePasskeyDialog, {
    props: { passkey, open: true },
    attachTo: document.body,
  })
  await flushPromises()
  const input = () => document.querySelector<HTMLInputElement>('[role="dialog"] input')!
  const save = () =>
    [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
      (b) => b.textContent?.trim() === 'Save',
    )!
  return { wrapper, input, save }
}

async function type(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

describe('RenamePasskeyDialog', () => {
  it('starts with the current name and refuses an empty or over-long name', async () => {
    useScenario('user-with-passkeys')
    const { wrapper, input, save } = await mountDialog()
    expect(input().value).toBe('Phone')
    await type(input(), '   ')
    save().click()
    await flushPromises()
    expect(document.body.textContent).toContain('This field is required.')
    expect(input().getAttribute('aria-invalid')).toBe('true')
    await type(input(), 'x'.repeat(256))
    save().click()
    await flushPromises()
    expect(document.body.textContent).toContain('Enter at most 255 characters.')
    expect(mockState().requests.some((r) => r.operationId === 'updatePasskey')).toBe(false)
    wrapper.unmount()
  })

  it('saves the trimmed name with If-Match and emits the result', async () => {
    useScenario('user-with-passkeys')
    const { wrapper, input, save } = await mountDialog()
    await type(input(), '  Work phone ')
    save().click()
    await vi.waitFor(() => expect(wrapper.emitted('saved')).toHaveLength(1))
    const request = mockState().requests.find((r) => r.operationId === 'updatePasskey')
    expect(request?.body).toEqual({ name: 'Work phone' })
    expect(request?.headers['if-match']).toBe('"pk-phone-1"')
    wrapper.unmount()
  })

  it('keeps the input after a 412 and reports the change elsewhere', async () => {
    useScenario('user-with-passkeys', {
      failures: { updatePasskey: { status: 412, times: 1 } },
    })
    const { wrapper, input, save } = await mountDialog()
    await type(input(), 'Mine')
    save().click()
    await vi.waitFor(() => expect(document.body.textContent).toContain('changed elsewhere'))
    expect(input().value).toBe('Mine')
    expect(wrapper.emitted('outdated')).toHaveLength(1)
    wrapper.unmount()
  })
})
