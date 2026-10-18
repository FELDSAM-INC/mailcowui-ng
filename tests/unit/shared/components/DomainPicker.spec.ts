// The shared domain picker (T008, UI 004 research D11, R7, FR-011): single and multiple modes, a
// debounced server search with "load more" in pages of 25, sources in labelled groups, options
// disabled with their reason, readable and ASCII names, keyboard operation without a Reka viewport,
// and the searching, no-match and error-with-retry states.
import { flushPromises } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadLegacy, resetLegacy } from '@/i18n/legacy'
import DomainPicker, {
  type DomainPickerOption,
  type DomainPickerSource,
} from '@/shared/components/DomainPicker.vue'

import { mountWithApp, resetTestPlugins } from '../../support/mount'

const domains = (count: number, prefix = 'd'): DomainPickerOption[] =>
  Array.from({ length: count }, (_, index) => ({
    name: `${prefix}${index + 1}.example`,
    nameUnicode: `${prefix}${index + 1}.example`,
  }))

function source(
  id: string,
  all: DomainPickerOption[],
  options: { label?: string; fail?: () => boolean } = {},
) {
  const calls: { q: string; offset: number; limit: number }[] = []
  const spec: DomainPickerSource = {
    id,
    label: options.label,
    queryKey: (q) => ['test', id, q],
    fetchPage: (params) => {
      calls.push(params)
      if (options.fail?.()) return Promise.reject(new Error('down'))
      const matches = all.filter((item) =>
        `${item.name} ${item.nameUnicode}`.includes(params.q.toLowerCase()),
      )
      return Promise.resolve({
        items: matches.slice(params.offset, params.offset + params.limit),
        total: matches.length,
      })
    },
  }
  return { spec, calls }
}

beforeEach(async () => {
  resetTestPlugins()
  await loadLegacy('en-gb')
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  resetLegacy()
})

async function settle() {
  vi.advanceTimersByTime(300)
  await flushPromises()
}

describe('DomainPicker', () => {
  it('searches the server 300 ms after typing and loads more in pages of 25', async () => {
    const { spec, calls } = source('domains', domains(60))
    const wrapper = mountWithApp(DomainPicker, {
      props: { id: 'p', label: 'Domain', sources: [spec], modelValue: null },
    })
    const input = wrapper.get('input')
    await input.trigger('focus')
    await settle()
    expect(calls.at(-1)).toEqual({ q: '', offset: 0, limit: 25 })
    expect(wrapper.findAll('[role="option"]')).toHaveLength(25)
    await wrapper.get('[data-load-more]').trigger('click')
    await settle()
    expect(calls.at(-1)).toEqual({ q: '', offset: 25, limit: 25 })
    expect(wrapper.findAll('[role="option"]')).toHaveLength(50)

    await input.setValue('d5')
    await input.trigger('input')
    expect(calls.at(-1)?.q).toBe('')
    await settle()
    expect(calls.at(-1)).toEqual({ q: 'd5', offset: 0, limit: 25 })
  })

  it('picks one value with the keyboard in single mode and reverts unchosen text', async () => {
    const { spec } = source('domains', domains(3))
    const wrapper = mountWithApp(DomainPicker, {
      props: { id: 'p', label: 'Target domain', sources: [spec], modelValue: null },
    })
    const input = wrapper.get('input')
    await input.trigger('focus')
    await settle()
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(input.attributes('aria-activedescendant')).toBeDefined()
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['d2.example'])
    expect(wrapper.emitted('pick')?.[0]).toEqual([
      { name: 'd2.example', nameUnicode: 'd2.example' },
    ])
    await wrapper.setProps({ modelValue: 'd2.example' })
    await input.trigger('focus')
    await input.setValue('zzz')
    await input.trigger('keydown', { key: 'Escape' })
    expect((input.element as HTMLInputElement).value).toBe('d2.example')
  })

  it('shows chosen names as removable chips in multiple mode', async () => {
    const { spec } = source('domains', domains(3))
    const wrapper = mountWithApp(DomainPicker, {
      props: {
        id: 'p',
        label: 'Domain',
        sources: [spec],
        modelValue: ['d1.example'],
        multiple: true,
        labels: { 'd1.example': 'd1.example' },
      },
    })
    const chip = wrapper.get('[data-picker-chips] button')
    expect(chip.attributes('aria-label')).toBe('Remove d1.example')
    await chip.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([[]])
    await wrapper.get('input').trigger('focus')
    await settle()
    await wrapper.findAll('[role="option"]')[2]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual([['d1.example', 'd3.example']])
  })

  it('lists several sources in labelled groups with readable and ASCII names', async () => {
    const domainSource = source('domains', [
      { name: 'xn--bcher-kva.example', nameUnicode: 'bücher.example' },
    ])
    const aliasSource = source('aliasDomains', [
      { name: 'example.net', nameUnicode: 'example.net' },
    ])
    domainSource.spec.label = 'Domains'
    aliasSource.spec.label = 'Domain aliases'
    const wrapper = mountWithApp(DomainPicker, {
      props: {
        id: 'p',
        label: 'Domain',
        sources: [domainSource.spec, aliasSource.spec],
        modelValue: [],
        multiple: true,
      },
    })
    await wrapper.get('input').trigger('focus')
    await settle()
    const groups = wrapper.findAll('[role="group"]')
    expect(groups).toHaveLength(2)
    expect(groups[0]!.text()).toContain('Domains')
    expect(groups[0]!.text()).toContain('bücher.example')
    expect(groups[0]!.text()).toContain('xn--bcher-kva.example')
    expect(groups[1]!.text()).toContain('Domain aliases')
    expect(groups[1]!.text()).not.toContain('example.netexample.net')
  })

  it('shows an option that cannot be chosen as disabled, with its reason', async () => {
    const { spec } = source('domains', domains(2))
    const wrapper = mountWithApp(DomainPicker, {
      props: {
        id: 'p',
        label: 'Target domain',
        sources: [spec],
        modelValue: null,
        disabledReason: (option: DomainPickerOption) =>
          option.name === 'd1.example' ? 'Target domain d1.example is a relay domain' : null,
      },
    })
    await wrapper.get('input').trigger('focus')
    await settle()
    const [first] = wrapper.findAll('[role="option"]')
    expect(first!.attributes('aria-disabled')).toBe('true')
    expect(first!.text()).toContain('Target domain d1.example is a relay domain')
    await first!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('says when nothing matches, and offers a retry after an error', async () => {
    let down = true
    const { spec } = source('domains', domains(2), { fail: () => down })
    const wrapper = mountWithApp(DomainPicker, {
      props: { id: 'p', label: 'Domain', sources: [spec], modelValue: null },
    })
    const input = wrapper.get('input')
    await input.trigger('focus')
    await settle()
    expect(wrapper.get('[role="alert"]').text()).toContain('The list could not be loaded.')
    down = false
    await wrapper.get('[role="alert"] button').trigger('click')
    await settle()
    expect(wrapper.findAll('[role="option"]')).toHaveLength(2)
    await input.setValue('nothing')
    await input.trigger('input')
    await settle()
    expect(wrapper.get('[role="status"]').text()).toBe('No matching records found')
  })

  it('does not use a Reka viewport', () => {
    const file = readFileSync(join(process.cwd(), 'src/shared/components/DomainPicker.vue'), 'utf8')
    expect(file).not.toMatch(/ComboboxViewport|SelectViewport|ScrollAreaViewport/)
  })
})
