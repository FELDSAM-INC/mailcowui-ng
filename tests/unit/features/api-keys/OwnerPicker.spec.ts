// T127: the owner picker (FR-064, FR-065, US7-AS12): a debounced search of the key-owner
// candidates, "load more" over an infinite query, the no-match and error states, and a free-text
// mode for the owner filter.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import OwnerPicker from '@/features/api-keys/components/OwnerPicker.vue'

import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

afterEach(() => {
  vi.useRealTimers()
})

function mountPicker(mode: 'pick' | 'filter' = 'pick', initial: string | null = null) {
  const value = ref<string | null>(initial)
  const Host = defineComponent({
    setup: () => () =>
      h(OwnerPicker, {
        id: 'owner',
        label: 'Owner',
        mode,
        modelValue: value.value,
        'onUpdate:modelValue': (next: string | null) => (value.value = next),
      }),
  })
  const wrapper = mountWithApp(Host, { attachTo: document.body })
  const input = wrapper.get<HTMLInputElement>('input[role="combobox"]')
  return { wrapper, value, input }
}

const searches = () =>
  mockState().requests.filter((r) => r.operationId === 'listApiKeyOwnerCandidates')

describe('OwnerPicker', () => {
  it('waits 300 ms after typing before it searches', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    useScenario('api-keys-many')
    const { input } = mountPicker()
    await input.setValue('res')
    await vi.advanceTimersByTimeAsync(250)
    expect(searches().some((r) => r.path.includes('q=res'))).toBe(false)
    await vi.advanceTimersByTimeAsync(100)
    await vi.waitFor(() => expect(searches().some((r) => r.path.includes('q=res'))).toBe(true))
  })

  it('lists usernames with roles, loads more on request and selects one', async () => {
    useScenario('api-keys-many')
    const { wrapper, input, value } = mountPicker()
    expect(input.attributes('aria-expanded')).toBe('false')
    await input.setValue('res')
    await vi.waitFor(() => expect(wrapper.findAll('[role="option"]')).toHaveLength(25), {
      timeout: 3000,
    })
    expect(input.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[role="listbox"]').attributes('id')).toBe(input.attributes('aria-controls'))
    expect(wrapper.findAll('[role="option"]')[0]!.text()).toMatch(
      /^reseller\s*Domain administrator$/,
    )
    await wrapper.get('button[data-load-more]').trigger('click')
    await vi.waitFor(() => expect(wrapper.findAll('[role="option"]')).toHaveLength(31))
    expect(wrapper.find('button[data-load-more]').exists()).toBe(false)
    expect(searches().some((r) => r.path.includes('offset=25'))).toBe(true)
    await wrapper.findAll('[role="option"]')[0]!.trigger('click')
    expect(value.value).toBe('reseller')
    expect(input.element.value).toBe('reseller')
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
  })

  it('moves through the options with the arrow keys and picks with Enter', async () => {
    useScenario('api-keys-many')
    const { wrapper, input, value } = mountPicker()
    await input.setValue('adm')
    await vi.waitFor(() => expect(wrapper.findAll('[role="option"]')).toHaveLength(1), {
      timeout: 3000,
    })
    await input.trigger('keydown', { key: 'ArrowDown' })
    const option = wrapper.get('[role="option"]')
    expect(input.attributes('aria-activedescendant')).toBe(option.attributes('id'))
    expect(option.attributes('aria-selected')).toBe('true')
    await input.trigger('keydown', { key: 'Enter' })
    expect(value.value).toBe('admin')
  })

  it('says when nothing matches, never offering mailbox users', async () => {
    useScenario('api-keys-many')
    const { wrapper, input } = mountPicker()
    await input.setValue('alice')
    await vi.waitFor(
      () => expect(wrapper.text()).toContain('No administrators or domain administrators match.'),
      { timeout: 3000 },
    )
    expect(wrapper.findAll('[role="option"]')).toHaveLength(0)
  })

  it('shows an error with a retry', async () => {
    useScenario('api-keys-many', {
      failures: { listApiKeyOwnerCandidates: { status: 500 } },
    })
    const { wrapper, input } = mountPicker()
    await input.setValue('res')
    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true), {
      timeout: 3000,
    })
    mockState().failures = {}
    await wrapper.get('[role="alert"] button').trigger('click')
    await vi.waitFor(() => expect(wrapper.findAll('[role="option"]').length).toBeGreaterThan(0))
  })

  it('accepts a typed username in filter mode', async () => {
    useScenario('api-keys-many')
    const { input, value } = mountPicker('filter')
    await input.setValue('former')
    await input.trigger('keydown', { key: 'Enter' })
    expect(value.value).toBe('former')
    await input.setValue('')
    await input.trigger('keydown', { key: 'Enter' })
    expect(value.value).toBeNull()
  })

  it('restores the chosen owner when the text is left unchosen in pick mode', async () => {
    useScenario('api-keys-many')
    const { input, value } = mountPicker('pick', 'admin')
    expect(input.element.value).toBe('admin')
    await input.setValue('somebody')
    await input.trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(input.element.value).toBe('admin')
    expect(value.value).toBe('admin')
  })
})
