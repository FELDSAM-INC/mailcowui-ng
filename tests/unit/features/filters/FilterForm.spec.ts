import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import * as filterApi from '@/features/filters/api'
import FilterForm from '@/features/filters/components/FilterForm.vue'
import { mockSieveFilter, sieveFilterView } from '../../../mocks/factories/sieve-filter'
import { useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

describe('legacy Sieve validation and submission', () => {
  it('enables creation only after validation and invalidates the check after any edit', async () => {
    useScenario('account-admin')
    const validate = vi
      .spyOn(filterApi, 'validateScript')
      .mockResolvedValue({ valid: true, message: null })
    const create = vi
      .spyOn(filterApi, 'createFilter')
      .mockResolvedValue(sieveFilterView(mockSieveFilter({ id: 44, mailbox: 'anna@example.org' })))
    const wrapper = mountWithApp(FilterForm, { props: { mailbox: 'anna@example.org' } })
    const add = () => wrapper.findAll('button').find((button) => button.text() === 'Add')!
    await wrapper.get('#filter-description').setValue('New rule')
    await wrapper.get('textarea').setValue('keep;')
    expect(add().attributes('disabled')).toBeDefined()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Validate')!
      .trigger('click')
    await flushPromises()
    expect(validate).toHaveBeenCalledWith('keep;')
    expect(add().attributes('disabled')).toBeUndefined()
    await wrapper.get('#filter-description').setValue('Renamed')
    expect(add().attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    expect(create).not.toHaveBeenCalled()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Validate')!
      .trigger('click')
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(create).toHaveBeenCalledTimes(1)
  })
  it('shows the parser message and never saves invalid edits', async () => {
    useScenario('account-admin')
    const validate = vi
      .spyOn(filterApi, 'validateScript')
      .mockResolvedValue({ valid: false, message: 'line 1: unknown command' })
    const update = vi.spyOn(filterApi, 'updateFilter')
    const stored = sieveFilterView(mockSieveFilter({ id: 1, mailbox: 'anna@example.org' }))
    const wrapper = mountWithApp(FilterForm, {
      props: { stored, mailbox: stored.mailbox },
      attachTo: document.body,
    })
    await wrapper.get('textarea').setValue('unknown;')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(validate).toHaveBeenCalledWith('unknown;')
    expect(wrapper.text()).toContain('line 1: unknown command')
    expect(wrapper.get('textarea').attributes('aria-invalid')).toBe('true')
    expect(update).not.toHaveBeenCalled()
  })
  it('ignores validation of a draft changed while the parser was running', async () => {
    useScenario('account-admin')
    let release!: (result: { valid: boolean; message: null }) => void
    vi.spyOn(filterApi, 'validateScript').mockReturnValue(
      new Promise((resolve) => {
        release = resolve
      }),
    )
    const wrapper = mountWithApp(FilterForm, { props: { mailbox: 'anna@example.org' } })
    await wrapper.get('#filter-description').setValue('Rule')
    await wrapper.get('textarea').setValue('keep;')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Validate')!
      .trigger('click')
    await wrapper.get('textarea').setValue('unknown;')
    release({ valid: true, message: null })
    await flushPromises()
    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text() === 'Add')!
        .attributes('disabled'),
    ).toBeDefined()
  })
})
