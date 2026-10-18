// The form fields that domains and templates share (UI 002 T024), as the classic forms have them.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { DomainTemplate } from '@/api'
import DomainNameField from '@/features/domains/components/fields/DomainNameField.vue'
import LimitField from '@/features/domains/components/fields/LimitField.vue'
import LegacyRateLimitField from '@/features/domains/components/fields/LegacyRateLimitField.vue'
import RelayOptionsField from '@/features/domains/components/fields/RelayOptionsField.vue'
import TagSetInput from '@/features/domains/components/fields/TagSetInput.vue'
import TemplateSelect from '@/features/domains/components/fields/TemplateSelect.vue'

import { mountWithApp } from '../../support/mount'

describe('LimitField', () => {
  it('brings up a numeric keypad and shows the number in use', async () => {
    const wrapper = mountWithApp(LimitField, {
      props: { id: 'mailboxes', label: 'Max. mailboxes', modelValue: '10', inUse: 8 },
    })
    const input = wrapper.get('input')
    expect(input.attributes('inputmode')).toBe('numeric')
    expect(input.attributes('pattern')).toBe('[0-9]*')
    expect(wrapper.text()).toContain('8 in use')
    await input.setValue('12')
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual(['12'])
  })
})

describe('TagSetInput', () => {
  function mountTags(props: Record<string, unknown> = {}) {
    return mountWithApp(TagSetInput, {
      attachTo: document.body,
      props: { id: 'tags', label: 'Tags', modelValue: ['b'], maxLength: 255, ...props },
    })
  }

  it('adds a tag with Enter, a comma and the Add button, and removes it with its own button', async () => {
    const wrapper = mountTags()
    const input = wrapper.get('input')
    expect(input.attributes('autocapitalize')).toBe('none')
    expect(input.attributes('autocorrect')).toBe('off')
    expect(input.attributes('spellcheck')).toBe('false')
    await input.setValue('c')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([['b', 'c']])
    await wrapper.setProps({ modelValue: ['b', 'c'] })
    await input.setValue('d,')
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([['b', 'c', 'd']])
    await wrapper.setProps({ modelValue: ['b', 'c', 'd'] })
    await input.setValue('e')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Add')!
      .trigger('click')
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([['b', 'c', 'd', 'e']])
    const remove = wrapper.get('button[aria-label="Remove tag b"]')
    await remove.trigger('click')
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([['c', 'd']])
  })

  it('refuses a tag that is too long and keeps case-only duplicates once', async () => {
    const wrapper = mountTags({ maxLength: 5 })
    const input = wrapper.get('input')
    await input.setValue('B, toolong')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.text()).toContain('at most 5 characters')
  })

  it('shows suggestions in a listbox and adds one with the keyboard', async () => {
    const wrapper = mountTags({ suggestions: ['customer-a', 'customer-b'] })
    const input = wrapper.get('input')
    expect(input.attributes('role')).toBe('combobox')
    await input.trigger('focus')
    await input.setValue('cust')
    expect(wrapper.emitted('search')!.at(-1)).toEqual(['cust'])
    const listbox = wrapper.get('[role="listbox"]')
    expect(listbox.findAll('[role="option"]').map((o) => o.text())).toEqual([
      'customer-a',
      'customer-b',
    ])
    expect(input.attributes('aria-expanded')).toBe('true')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(input.attributes('aria-activedescendant')).toBe(
      listbox.findAll('[role="option"]')[1]!.attributes('id'),
    )
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([['b', 'customer-b']])
    await input.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    expect(document.querySelector('[class*="Viewport"]')).toBeNull()
  })

  it('says when suggestions load or fail, and typing a tag keeps working', async () => {
    const wrapper = mountTags({ suggestions: [], suggestionsState: 'loading' })
    const input = wrapper.get('input')
    await input.trigger('focus')
    await input.setValue('x')
    expect(wrapper.text()).toContain('Loading suggestions')
    await wrapper.setProps({ suggestionsState: 'error' })
    expect(wrapper.text()).toContain('Suggestions unavailable')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([['b', 'x']])
  })

  it('marks a chip with its own error by index', () => {
    const wrapper = mountTags({ modelValue: ['ok', 'bad'], chipErrors: { 1: ['Not found.'] } })
    const chips = wrapper.findAll('li')
    expect(chips[1]!.text()).toContain('Not found.')
    expect(chips[0]!.text()).not.toContain('Not found.')
  })
})

describe('RelayOptionsField', () => {
  it('has the classic labels and notes, and keeps each checkbox independent', async () => {
    const wrapper = mountWithApp(RelayOptionsField, {
      props: {
        idPrefix: 'relay',
        modelValue: { backupMx: false, relayAllRecipients: false, relayUnknownOnly: false },
      },
    })
    expect(wrapper.get('legend').text()).toBe('Relay options')
    expect(wrapper.text()).toContain('blind')
    expect(wrapper.text()).toContain('transport maps')
    await wrapper.get('input#relay-relayUnknownOnly').setValue(true)
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([
      { backupMx: false, relayAllRecipients: false, relayUnknownOnly: true },
    ])
  })
})

describe('LegacyRateLimitField', () => {
  it('asks for one number with the "Disabled" placeholder and the classic frames', async () => {
    const wrapper = mountWithApp(LegacyRateLimitField, {
      props: { idPrefix: 'rl', value: '', frame: 'second' },
    })
    expect(wrapper.get('legend').text()).toBe('Rate limit')
    expect(wrapper.get('input').attributes('placeholder')).toBe('Disabled')
    expect(wrapper.findAll('option').map((option) => option.text())).toEqual([
      'msgs / second',
      'msgs / minute',
      'msgs / hour',
      'msgs / day',
    ])
    await wrapper.get('input').setValue('20')
    await wrapper.get('select').setValue('day')
    expect(wrapper.emitted('update:value')!.at(-1)).toEqual(['20'])
    expect(wrapper.emitted('update:frame')!.at(-1)).toEqual(['day'])
  })
})

describe('DomainNameField', () => {
  it("turns off capitalisation and correction, and names an invalid domain with legacy's message", async () => {
    const wrapper = mountWithApp(DomainNameField, {
      props: { id: 'name', label: 'Domain', modelValue: '' },
    })
    const input = wrapper.get('input')
    expect(input.attributes('autocapitalize')).toBe('none')
    expect(input.attributes('autocorrect')).toBe('off')
    expect(input.attributes('spellcheck')).toBe('false')
    await wrapper.setProps({ modelValue: 'bad_name.example' })
    await input.trigger('blur')
    await flushPromises()
    expect(wrapper.text()).toContain('Domain name is empty or invalid')
    await wrapper.setProps({ modelValue: 'münchen.de' })
    await input.trigger('blur')
    expect(wrapper.text()).not.toContain('invalid')
  })
})

describe('TemplateSelect', () => {
  const template = (id: number, name: string, isDefault = false) =>
    ({ id, name, isDefault }) as DomainTemplate

  it('lists the templates by name with the Default template first', () => {
    const wrapper = mountWithApp(TemplateSelect, {
      props: {
        id: 'template',
        label: 'Template',
        modelValue: 1,
        templates: [template(2, 'Reseller'), template(1, 'Default', true)],
      },
    })
    const select = wrapper.get('select')
    expect((select.element as HTMLSelectElement).value).toBe('1')
    expect(select.findAll('option').map((o) => o.text())).toEqual(['Default', 'Reseller'])
  })
})
