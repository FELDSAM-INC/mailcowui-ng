// The typed confirmation and rich content of ConfirmDialog (UI 002 T017, UI 001 R20): the confirm
// button stays disabled until one accepted value is typed, content renders inside the labelled
// dialog, focus is trapped and returned, and Escape cancels.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import { useConfirm } from '@/shared/composables/useConfirm'

import { mountWithApp } from '../../support/mount'

const Impact = defineComponent({
  props: { aliases: { type: Number, required: true } },
  setup: (props) => () => h('p', { 'data-impact': '' }, `${props.aliases} aliases will be removed`),
})

function mountHost() {
  let confirm!: ReturnType<typeof useConfirm>
  const Host = defineComponent({
    setup() {
      confirm = useConfirm()
      return () => h('div', [h('button', { id: 'trigger' }, 'Delete'), h(ConfirmDialog)])
    },
  })
  const wrapper = mountWithApp(Host, { attachTo: document.body })
  return { wrapper, confirm: () => confirm }
}

const confirmButton = () =>
  [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find(
    (button) => button.textContent?.trim() === 'Delete domain',
  )!

async function type(value: string) {
  const input = document.querySelector<HTMLInputElement>('[role="alertdialog"] input')!
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

describe('ConfirmDialog with requireTyped and content', () => {
  it('keeps confirm disabled until an accepted value is typed, ignoring case', async () => {
    const { wrapper, confirm } = mountHost()
    const answer = confirm()({
      title: 'Delete münchen.de?',
      confirmLabel: 'Delete domain',
      destructive: true,
      requireTyped: {
        accepted: ['münchen.de', 'xn--mnchen-3ya.de'],
        ignoreCase: true,
        labelKey: 'domains.delete.typeName',
        labelParams: { name: 'münchen.de' },
      },
    })
    await flushPromises()
    expect(confirmButton().disabled).toBe(true)
    await type('münchen')
    expect(confirmButton().disabled).toBe(true)
    await type('XN--MNCHEN-3YA.DE')
    expect(confirmButton().disabled).toBe(false)
    confirmButton().click()
    await expect(answer).resolves.toBe(true)
    wrapper.unmount()
  })

  it('labels the typed field and turns off capitalisation, correction and autocomplete', async () => {
    const { wrapper, confirm } = mountHost()
    void confirm()({
      title: 'Delete 3 domains?',
      confirmLabel: 'Delete domain',
      requireTyped: {
        accepted: ['3'],
        labelKey: 'bulk.confirm.typeCount',
        labelParams: { count: 3 },
      },
    })
    await flushPromises()
    const input = document.querySelector<HTMLInputElement>('[role="alertdialog"] input')!
    expect(input.getAttribute('autocapitalize')).toBe('none')
    expect(input.getAttribute('autocomplete')).toBe('off')
    expect(input.getAttribute('spellcheck')).toBe('false')
    const label = document.querySelector(`label[for="${input.id}"]`)
    expect(label?.textContent).toContain('3')
    wrapper.unmount()
  })

  it('renders content inside the labelled dialog, traps focus and returns it on Escape', async () => {
    const { wrapper, confirm } = mountHost()
    const trigger = document.getElementById('trigger') as HTMLButtonElement
    trigger.focus()
    const answer = confirm()({
      title: 'Delete gone.example?',
      confirmLabel: 'Delete domain',
      content: { component: Impact, props: { aliases: 2 } },
    })
    await flushPromises()
    const dialog = document.querySelector<HTMLElement>('[role="alertdialog"]')!
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toContain(
      'Delete gone.example?',
    )
    expect(dialog.querySelector('[data-impact]')?.textContent).toBe('2 aliases will be removed')
    expect(dialog.contains(document.activeElement)).toBe(true)
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await expect(answer).resolves.toBe(false)
    await flushPromises()
    expect(document.activeElement).toBe(trigger)
    wrapper.unmount()
  })

  it('offers only a close action for an information dialog', async () => {
    const { wrapper, confirm } = mountHost()
    const answer = confirm()({ title: 'Cannot delete', confirmLabel: 'Close', alertOnly: true })
    await flushPromises()
    const buttons = [...document.querySelectorAll('[role="alertdialog"] button')]
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Close'])
    ;(buttons[0] as HTMLButtonElement).click()
    await expect(answer).resolves.toBe(false)
    wrapper.unmount()
  })
})
