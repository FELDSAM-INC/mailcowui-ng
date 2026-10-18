// The multi-entry field (T021, UI 004 research R8): a labelled textarea with the classic help text,
// input attributes for addresses, a marker per entry where the caller gives one (Catch-All), server
// errors shown on the entry they name and linked to the field, a read-only mode, and long entries
// that wrap.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { h } from 'vue'

import { loadLegacy, resetLegacy } from '@/i18n/legacy'
import EntryListField from '@/shared/components/EntryListField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import { isCatchAll } from '@/shared/validation/entry-list'

import { mountWithApp } from '../../support/mount'

beforeEach(async () => {
  await loadLegacy('en-gb')
})
afterEach(() => resetLegacy())

const catchAll = (value: string) => (isCatchAll(value) ? 'Catch-All' : null)

describe('EntryListField', () => {
  it('is a labelled textarea with its help text and address input attributes', () => {
    const wrapper = mountWithApp(EntryListField, {
      props: { id: 'addresses', label: 'Alias address/es', modelValue: '' },
      slots: { help: () => h(LegacyText, { k: 'add.alias_address_info' }) },
    })
    const textarea = wrapper.get('textarea')
    expect(wrapper.get('label').attributes('for')).toBe('addresses')
    expect(textarea.attributes('autocapitalize')).toBe('none')
    expect(textarea.attributes('autocorrect')).toBe('off')
    expect(textarea.attributes('spellcheck')).toBe('false')
    const help = wrapper.get('#addresses-help')
    expect(help.text()).toContain('mailcow domains only')
    expect(textarea.attributes('aria-describedby')).toContain('addresses-help')
  })

  it('emits the text and marks entries the caller names', async () => {
    const wrapper = mountWithApp(EntryListField, {
      props: {
        id: 'a',
        label: 'Alias',
        modelValue: '@example.org, info@example.org',
        marker: catchAll,
      },
    })
    const marked = wrapper.findAll('[data-entry-marker]')
    expect(marked).toHaveLength(1)
    expect(marked[0]!.text()).toContain('Catch-All')
    expect(marked[0]!.text()).toContain('@example.org')
    await wrapper.get('textarea').setValue('x@example.org')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['x@example.org'])
  })

  it('shows server errors on the entry with the index they name, linked and announced as errors', () => {
    const wrapper = mountWithApp(EntryListField, {
      props: {
        id: 'goto',
        label: 'Goto addresses',
        modelValue: 'anna@example.org, bad, bob@example.org',
        entryErrors: { 1: ['Goto address bad is invalid'] },
        errors: ['An alias address must contain at least one valid goto address'],
      },
    })
    const textarea = wrapper.get('textarea')
    expect(textarea.attributes('aria-invalid')).toBe('true')
    const described = textarea.attributes('aria-describedby')!.split(' ')
    expect(described).toEqual(expect.arrayContaining(['goto-error', 'goto-entries']))
    const entry = wrapper.get('#goto-entries li')
    expect(entry.text()).toContain('bad')
    expect(entry.text()).toContain('Goto address bad is invalid')
    expect(wrapper.get('#goto-error').text()).toContain('at least one valid goto address')
  })

  it('shows the entries as text in read-only mode', () => {
    const wrapper = mountWithApp(EntryListField, {
      props: {
        id: 'ext',
        label: 'External',
        modelValue: 'a@x.example, @y.example',
        readonly: true,
      },
    })
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.findAll('li').map((item) => item.text())).toEqual(['a@x.example', '@y.example'])
  })

  it('wraps very long entries', () => {
    const long = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.example`
    const wrapper = mountWithApp(EntryListField, {
      props: { id: 'l', label: 'Long', modelValue: long, readonly: true },
    })
    expect(wrapper.get('li').classes()).toContain('break-all')
  })
})
