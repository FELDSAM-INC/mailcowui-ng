import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { loadLegacy } from '@/i18n/legacy'
import DomainPicker, { type DomainPickerSource } from '@/shared/components/DomainPicker.vue'
import { installMatchMedia } from '../../support/media'
import { mountWithApp } from '../../support/mount'

beforeAll(() => loadLegacy('en-gb'))
afterEach(() => vi.unstubAllGlobals())
function setup(wide = false) {
  const media = installMatchMedia({ '(min-width: 768px)': wide })
  let failed = false
  const fetchPage = vi.fn(
    async ({ q, offset, limit }: { q: string; offset: number; limit: number }) => {
      if (failed) return Promise.reject(new Error('Unavailable'))
      const items = Array.from({ length: 3000 }, (_, index) => ({
        name: `d${index}.example`,
        nameUnicode: `d${index}.example`,
      })).filter((item) => item.name.includes(q))
      return Promise.resolve({ items: items.slice(offset, offset + limit), total: items.length })
    },
  )
  const source: DomainPickerSource = {
    id: 'domains',
    queryKey: (q) => ['picker-test', q],
    fetchPage,
  }
  const wrapper = mountWithApp(DomainPicker, {
    attachTo: document.body,
    props: {
      id: 'domains',
      label: 'Domain assignments',
      multiple: true,
      staged: true,
      required: true,
      modelValue: ['d0.example'],
      sources: [source],
    },
  })
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!
  const button = (name: string) =>
    [...dialog().querySelectorAll<HTMLButtonElement>('button')].find(
      (item) => item.textContent?.trim() === name,
    )!
  const checkbox = (name: string) =>
    dialog().querySelector<HTMLInputElement>(`input[value="${name}"]`)!
  const open = async () => {
    await wrapper.get('[data-picker-open]').trigger('click')
    await vi.waitFor(() =>
      expect(dialog()?.querySelectorAll('input[type="checkbox"]').length).toBeGreaterThan(0),
    )
  }
  return {
    wrapper,
    media,
    fetchPage,
    dialog,
    button,
    checkbox,
    open,
    fail: (value: boolean) => {
      failed = value
    },
  }
}
it('stages checkbox choices in a mobile dialog and applies ASCII names only on Done', async () => {
  const { wrapper, fetchPage, open, dialog, checkbox, button } = setup()
  expect(fetchPage).not.toHaveBeenCalled()
  expect(wrapper.get('[data-picker-open]').attributes('aria-required')).toBeUndefined()
  await open()
  expect(dialog().classList.contains('h-dvh')).toBe(true)
  expect(dialog().textContent).toContain('Domain assignments')
  expect(document.activeElement).toBe(dialog().querySelector('input[type="search"]'))
  checkbox('d0.example').click()
  checkbox('d1.example').click()
  expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  expect(wrapper.get('[data-picker-chips]').text()).toBe('d0.example')
  button('Done').click()
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
  expect(wrapper.emitted('update:modelValue')).toEqual([[['d1.example']]])
  expect(document.activeElement).toBe(wrapper.get('[data-picker-open]').element)
})
it.each(['Cancel', 'Escape', 'Close'])(
  'discards uncommitted choices on %s and reopens the applied selection',
  async (action) => {
    const { wrapper, open, dialog, checkbox, button } = setup()
    await open()
    checkbox('d1.example').click()
    if (action === 'Escape')
      dialog().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    else if (action === 'Close')
      dialog().querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')!.click()
    else button(action).click()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await open()
    expect(checkbox('d0.example').checked).toBe(true)
    expect(checkbox('d1.example').checked).toBe(false)
  },
)
it('requests 25 domains at a time and keeps staged choices across server searches', async () => {
  const { wrapper, open, dialog, checkbox, fetchPage, button } = setup()
  await open()
  expect(fetchPage).toHaveBeenLastCalledWith({ q: '', offset: 0, limit: 25 })
  checkbox('d1.example').click()
  button('Load more').click()
  await vi.waitFor(() =>
    expect(dialog().querySelectorAll('input[type="checkbox"]')).toHaveLength(50),
  )
  expect(fetchPage).toHaveBeenLastCalledWith({ q: '', offset: 25, limit: 25 })
  const search = dialog().querySelector<HTMLInputElement>('input[type="search"]')!
  search.value = 'd2999'
  search.dispatchEvent(new Event('input', { bubbles: true }))
  expect(fetchPage).toHaveBeenCalledTimes(2)
  await vi.waitFor(() => expect(checkbox('d2999.example')).not.toBeNull())
  checkbox('d2999.example').click()
  button('Done').click()
  await flushPromises()
  expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([
    ['d0.example', 'd1.example', 'd2999.example'],
  ])
})
it('discards a mobile draft when resizing to the existing desktop inline picker', async () => {
  const { wrapper, open, checkbox, media } = setup()
  await open()
  checkbox('d1.example').click()
  media.set('(min-width: 768px)', true)
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
  expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  expect(wrapper.find('input[role="combobox"]').exists()).toBe(true)
})
it('shows a fetch error with retry inside the dialog', async () => {
  const { wrapper, dialog, fail, button } = setup()
  fail(true)
  await wrapper.get('[data-picker-open]').trigger('click')
  await vi.waitFor(() =>
    expect(dialog()?.querySelector('[role="alert"]')?.textContent).toContain(
      'The list could not be loaded',
    ),
  )
  fail(false)
  button('Try again').click()
  await vi.waitFor(() =>
    expect(dialog().querySelectorAll('input[type="checkbox"]')).toHaveLength(25),
  )
})
it('shows Unicode choices but applies ASCII names and keeps unavailable options disabled', async () => {
  const { wrapper, fetchPage, open, dialog, checkbox, button } = setup()
  fetchPage.mockResolvedValueOnce({
    items: [
      { name: 'xn--bcher-kva.example', nameUnicode: 'bücher.example' },
      { name: 'unavailable.example', nameUnicode: 'unavailable.example' },
    ],
    total: 2,
  })
  await wrapper.setProps({
    modelValue: [],
    disabledReason: (option) => (option.name === 'unavailable.example' ? 'Not available' : null),
  })
  await open()
  expect(dialog().textContent).toContain('bücher.example')
  expect(dialog().textContent).toContain('xn--bcher-kva.example')
  expect(checkbox('unavailable.example').disabled).toBe(true)
  expect(dialog().textContent).toContain('Not available')
  checkbox('xn--bcher-kva.example').click()
  button('Done').click()
  await flushPromises()
  expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['xn--bcher-kva.example']])
  expect(wrapper.emitted('pick')?.[0]).toEqual([
    { name: 'xn--bcher-kva.example', nameUnicode: 'bücher.example' },
  ])
})
it('labels Unicode chips with ASCII titles and keeps indexed server errors on the matching name', async () => {
  const { wrapper } = setup()
  await wrapper.setProps({
    modelValue: ['xn--bcher-kva.example', 'valid.example'],
    labels: { 'xn--bcher-kva.example': 'bücher.example' },
    itemErrors: { 'xn--bcher-kva.example': ['Domain no longer exists'] },
  })
  const chips = wrapper.findAll('[data-picker-chips] > li')
  expect(chips[0]!.get('button').text()).toBe('bücher.example')
  expect(chips[0]!.get('button').attributes('title')).toBe('xn--bcher-kva.example')
  expect(chips[0]!.text()).toContain('Domain no longer exists')
  expect(chips[0]!.get('button').attributes('aria-describedby')).toBeTruthy()
  expect(chips[1]!.text()).not.toContain('Domain no longer exists')
  await chips[0]!.get('button').trigger('click')
  expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['valid.example']])
})
