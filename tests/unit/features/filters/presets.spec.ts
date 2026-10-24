import { installMatchMedia } from '../../support/media'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FilterForm from '@/features/filters/components/FilterForm.vue'
import { loadFeatureMessages } from '@/i18n'
import { settleConfirm } from '@/shared/composables/useConfirm'
import { mockSieveFilter, sieveFilterView } from '../../../mocks/factories/sieve-filter'
import { useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'
beforeEach(() => {
  installMatchMedia()
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})
})
describe('Sieve create presets (T108/T115)', () => {
  it('fills an empty description and script, then preserves a supplied description on confirmed replacement', async () => {
    useScenario('account-admin')
    await loadFeatureMessages('system-settings')
    const wrapper = mountWithApp(FilterForm, { props: { mailbox: 'anna@example.org' } })
    await vi.waitFor(() => expect(wrapper.find('[data-preset="sieve_1"]').exists()).toBe(true))
    await wrapper.get('[data-preset="sieve_1"] button').trigger('click')
    expect((wrapper.get('#filter-description').element as HTMLInputElement).value).toBe(
      'Discard mail with probable dangerous file types',
    )
    expect((wrapper.get('#filter-script').element as HTMLTextAreaElement).value).toContain(
      'require',
    )
    await wrapper.get('#filter-description').setValue('My description')
    const before = (wrapper.get('#filter-script').element as HTMLTextAreaElement).value
    await wrapper.get('[data-preset="sieve_8"] button').trigger('click')
    settleConfirm(false)
    expect((wrapper.get('#filter-script').element as HTMLTextAreaElement).value).toBe(before)
    await wrapper.get('[data-preset="sieve_8"] button').trigger('click')
    settleConfirm(true)
    await vi.waitFor(() =>
      expect((wrapper.get('#filter-script').element as HTMLTextAreaElement).value).not.toBe(before),
    )
    expect((wrapper.get('#filter-description').element as HTMLInputElement).value).toBe(
      'My description',
    )
    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text() === 'Add')
        ?.attributes('disabled'),
    ).toBeDefined()
  })
  it('does not offer examples on existing filters', async () => {
    useScenario('account-admin')
    await loadFeatureMessages('account')
    const wrapper = mountWithApp(FilterForm, {
      props: { stored: sieveFilterView(mockSieveFilter({ id: 1, mailbox: 'anna@example.org' })) },
    })
    expect(wrapper.find('[data-preset-picker]').exists()).toBe(false)
    expect(wrapper.find('[data-code-editor]').exists()).toBe(true)
  })
})
