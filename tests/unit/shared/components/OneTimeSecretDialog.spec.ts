// T127 (as OneTimeSecretDialog): the one-time secret dialog (FR-066, conventions "Secrets",
// data-model §7). Copying is confirmed and announced; a refusal selects the secret for manual
// copying; closing, Escape or leaving uncopied asks for confirmation; the secret exists only in
// the dialog and never reaches storage, the router or the query cache.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import OneTimeSecretDialog from '@/shared/components/OneTimeSecretDialog.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'

import { mountWithApp, testPlugins } from '../../support/mount'

const SECRET = 'mcv2_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789AbCd'

afterEach(() => {
  settleConfirm(false)
})

function stubClipboard(result: 'copied' | 'refused') {
  const writeText = vi.fn(() =>
    result === 'copied'
      ? Promise.resolve()
      : Promise.reject(new DOMException('no', 'NotAllowedError')),
  )
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  return writeText
}

function mountDialog() {
  const secret = ref<string | null>(SECRET)
  const closed = vi.fn(() => {
    secret.value = null
  })
  const dialog = ref<{ requestClose: () => Promise<boolean> } | null>(null)
  const Host = defineComponent({
    setup: () => () =>
      h(OneTimeSecretDialog, {
        ref: dialog,
        secret: secret.value,
        title: 'Your new API key',
        description: 'Store it safely.',
        onClose: closed,
      }),
  })
  const wrapper = mountWithApp(Host, { attachTo: document.body })
  const find = (selector: string) => document.querySelector<HTMLElement>(selector)
  const button = (name: string) =>
    [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
      (b) => b.textContent?.trim() === name,
    )
  return { wrapper, secret, closed, dialog, find, button }
}

describe('OneTimeSecretDialog', () => {
  it('shows the secret once with a warning and a copy button', async () => {
    const { find } = mountDialog()
    await vi.waitFor(() => expect(find('[role="dialog"]')).not.toBeNull())
    const field = find('[role="dialog"] input') as HTMLInputElement
    expect(field.value).toBe(SECRET)
    expect(field.readOnly).toBe(true)
    expect(find('[role="dialog"]')?.textContent).toContain(
      'This secret is shown only once. It cannot be shown again.',
    )
    expect(find('[role="dialog"]')?.getAttribute('aria-labelledby')).toBeTruthy()
  })

  it('copies, confirms in text, and then closes without asking', async () => {
    const writeText = stubClipboard('copied')
    const { button, find, closed } = mountDialog()
    await vi.waitFor(() => expect(button('Copy')).toBeDefined())
    button('Copy')!.click()
    await vi.waitFor(() =>
      expect(find('[role="dialog"] [role="status"]')?.textContent).toContain(
        'Copied to the clipboard.',
      ),
    )
    expect(writeText).toHaveBeenCalledWith(SECRET)
    button('Close')!.click()
    await flushPromises()
    expect(confirmState.value).toBeNull()
    expect(closed).toHaveBeenCalledTimes(1)
  })

  it('selects the secret for manual copying when the clipboard is refused', async () => {
    stubClipboard('refused')
    const { button, find } = mountDialog()
    await vi.waitFor(() => expect(button('Copy')).toBeDefined())
    button('Copy')!.click()
    await vi.waitFor(() =>
      expect(find('[role="dialog"]')?.textContent).toContain(
        'The browser did not allow copying. The secret is selected: copy it yourself.',
      ),
    )
    const field = find('[role="dialog"] input') as HTMLInputElement
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, SECRET.length])
  })

  it('asks before closing uncopied, and stays open when the user goes back', async () => {
    const { button, closed, find } = mountDialog()
    await vi.waitFor(() => expect(button('Close')).toBeDefined())
    button('Close')!.click()
    await vi.waitFor(() => expect(confirmState.value?.title).toBe('Have you saved the secret?'))
    settleConfirm(false)
    await flushPromises()
    expect(closed).not.toHaveBeenCalled()
    expect(find('[role="dialog"]')).not.toBeNull()

    button('Close')!.click()
    await vi.waitFor(() => expect(confirmState.value).not.toBeNull())
    settleConfirm(true)
    await vi.waitFor(() => expect(closed).toHaveBeenCalledTimes(1))
  })

  it('asks the same with Escape', async () => {
    const { find } = mountDialog()
    await vi.waitFor(() => expect(find('[role="dialog"]')).not.toBeNull())
    find('[role="dialog"]')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    await vi.waitFor(() => expect(confirmState.value?.title).toBe('Have you saved the secret?'))
  })

  it('lets the page ask before leaving (requestClose)', async () => {
    const { dialog, closed } = mountDialog()
    await vi.waitFor(() => expect(dialog.value).not.toBeNull())
    const leaving = dialog.value!.requestClose()
    await vi.waitFor(() => expect(confirmState.value).not.toBeNull())
    settleConfirm(true)
    expect(await leaving).toBe(true)
    expect(closed).toHaveBeenCalledTimes(1)
  })

  it('writes nothing to storage or the query cache', async () => {
    const setLocal = vi.spyOn(Storage.prototype, 'setItem')
    stubClipboard('copied')
    const { button, find } = mountDialog()
    await vi.waitFor(() => expect(button('Copy')).toBeDefined())
    button('Copy')!.click()
    await vi.waitFor(() => expect(find('[role="dialog"] [role="status"]')).not.toBeNull())
    button('Close')!.click()
    await vi.waitFor(() => expect(find('[role="dialog"]')).toBeNull())
    expect(setLocal).not.toHaveBeenCalled()
    expect(testPlugins().queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(document.body.textContent ?? '').not.toContain(SECRET)
    expect(find('[role="dialog"]')).toBeNull()
  })
})
