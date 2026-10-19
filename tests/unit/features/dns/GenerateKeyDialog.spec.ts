// The generation dialog (T045, FR-025, FR-026, FR-081, FR-085; legacy add form): the names
// read-only, the selector pre-filled from the server's default with its rules, the key lengths of
// the server with its default, one submission, focus on the heading, and no Escape while sending.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import GenerateKeyDialog from '@/features/dns/components/GenerateKeyDialog.vue'

import { mountWithApp } from '../../support/mount'
import { dnsCapabilities } from './fixtures'

const names = [
  { name: 'example.net', label: 'example.net' },
  { name: 'missing.example', label: 'missing.example' },
]

async function mountDialog(props: Record<string, unknown> = {}) {
  const wrapper = mountWithApp(GenerateKeyDialog, {
    props: {
      open: true,
      names,
      skipped: [],
      caps: dnsCapabilities('admin', { selector: 'feldhost' }),
      ...props,
    },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const body = () => document.body

describe('GenerateKeyDialog', () => {
  it('shows the names read-only and the defaults of the server', async () => {
    const wrapper = await mountDialog()
    expect(body().textContent).toContain('Add ARC/DKIM key')
    expect(body().textContent).toContain('Domain/s')
    expect(body().textContent).toContain('missing.example')
    const selector = body().querySelector<HTMLInputElement>('#dkim-generate-selector')!
    expect(selector.value).toBe('feldhost')
    expect(selector.getAttribute('autocapitalize')).toBe('none')
    expect(selector.getAttribute('autocorrect')).toBe('off')
    expect(selector.getAttribute('spellcheck')).toBe('false')
    const size = body().querySelector<HTMLSelectElement>('#dkim-generate-size')!
    expect([...size.options].map((option) => option.value)).toEqual([
      '1024',
      '2048',
      '3072',
      '4096',
    ])
    expect(size.value).toBe('2048')
    expect(document.activeElement?.textContent).toContain('Add ARC/DKIM key')
    wrapper.unmount()
  })

  it('emits the selector and key length once', async () => {
    const wrapper = await mountDialog()
    const size = body().querySelector<HTMLSelectElement>('#dkim-generate-size')!
    size.value = '4096'
    size.dispatchEvent(new Event('change'))
    const form = body().querySelector('form')!
    form.dispatchEvent(new Event('submit', { cancelable: true }))
    form.dispatchEvent(new Event('submit', { cancelable: true }))
    await flushPromises()
    expect(wrapper.emitted('submit')).toEqual([[{ selector: 'feldhost', keySize: 4096 }]])
    wrapper.unmount()
  })

  it.each([['a b'], [''], ['x'.repeat(256)]])(
    'refuses the selector "%s" before sending',
    async (value) => {
      const wrapper = await mountDialog()
      const selector = body().querySelector<HTMLInputElement>('#dkim-generate-selector')!
      selector.value = value
      selector.dispatchEvent(new Event('input'))
      body()
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { cancelable: true }))
      await flushPromises()
      expect(wrapper.emitted('submit')).toBeUndefined()
      expect(body().textContent).toContain('DKIM domain or selector invalid: example.net')
      expect(selector.getAttribute('aria-invalid')).toBe('true')
      wrapper.unmount()
    },
  )

  it('lists entries that already have a key as skipped', async () => {
    const wrapper = await mountDialog({ skipped: [{ name: 'example.org', label: 'example.org' }] })
    expect(body().textContent).toContain('already have a key')
    expect(body().textContent).toContain('example.org')
    wrapper.unmount()
  })

  it('shows at most 10 names and counts the others', async () => {
    const many = Array.from({ length: 14 }, (_, index) => ({
      name: `n${index}.example`,
      label: `n${index}.example`,
    }))
    const wrapper = await mountDialog({ names: many })
    expect(body().textContent).toContain('n9.example')
    expect(body().textContent).not.toContain('n10.example')
    expect(body().textContent).toContain('and 4 others')
    wrapper.unmount()
  })

  it('cannot be closed with Escape while sending', async () => {
    const wrapper = await mountDialog({ pending: true })
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    await flushPromises()
    expect(wrapper.emitted('update:open')).toBeUndefined()
    const submit = body().querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(submit.disabled).toBe(true)
    wrapper.unmount()
  })
})
