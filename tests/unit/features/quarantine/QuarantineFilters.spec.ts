import { afterEach, describe, expect, it, vi } from 'vitest'

import QuarantineFilters from '@/features/quarantine/components/list/QuarantineFilters.vue'
import { NO_FILTERS } from '@/features/quarantine/list-state'

import { installMatchMedia } from '../../support/media'
import { mountWithApp } from '../../support/mount'

const mounted: { unmount(): void }[] = []
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.unstubAllGlobals()
})
function open(scoped = false) {
  installMatchMedia({ '(min-width: 768px)': true })
  const wrapper = mountWithApp(QuarantineFilters, {
    props: { filters: { ...NO_FILTERS, action: [] }, scoped },
  })
  mounted.push(wrapper)
  return wrapper
}

describe('QuarantineFilters', () => {
  it('keeps edits in a draft until Apply and sends selected actions together', async () => {
    const wrapper = open()
    await wrapper.get('[data-filter-toggle]').trigger('click')
    await wrapper.get('input[value="rejected"]').setValue(true)
    await wrapper.get('input[value="junk"]').setValue(true)
    await wrapper.get('#quarantine-virus').setValue('true')
    expect(wrapper.emitted('apply')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('apply')?.[0]?.[0]).toMatchObject({
      action: ['rejected', 'junk'],
      virus: 'true',
    })
    expect(wrapper.find('#quarantine-recipient').exists()).toBe(false)
  })

  it('blocks inverted dates and scores, and invalid decimal entries', async () => {
    const wrapper = open()
    await wrapper.get('[data-filter-toggle]').trigger('click')
    const apply = wrapper.get('button[type="submit"]')
    await wrapper.get('#quarantine-from').setValue('2026-10-12')
    await wrapper.get('#quarantine-to').setValue('2026-10-11')
    expect(apply.attributes('disabled')).toBeDefined()
    expect(wrapper.get('#quarantine-from').attributes('aria-invalid')).toBe('true')
    await wrapper.get('#quarantine-to').setValue('2026-10-12')
    expect(apply.attributes('disabled')).toBeUndefined()
    await wrapper.get('#quarantine-min-score').setValue('9.9')
    await wrapper.get('#quarantine-max-score').setValue('6.5')
    expect(apply.attributes('disabled')).toBeDefined()
    await wrapper.get('#quarantine-max-score').setValue('10.0')
    expect(apply.attributes('disabled')).toBeUndefined()
    await wrapper.get('#quarantine-min-score').setValue('invalid')
    expect(apply.attributes('disabled')).toBeDefined()
  })

  it('offers recipient scope only to administrators and validates its address', async () => {
    const wrapper = open(true)
    await wrapper.get('[data-filter-toggle]').trigger('click')
    await wrapper.get('#quarantine-recipient').setValue('not-an-address')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await wrapper.get('#quarantine-recipient').setValue('bob@example.org')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('apply')?.[0]?.[0]).toMatchObject({ recipient: 'bob@example.org' })
  })

  it('clears filters while keeping the search, and removes one action chip', async () => {
    const wrapper = open()
    await wrapper.setProps({
      filters: { ...NO_FILTERS, q: 'invoice', action: ['rejected', 'junk'], virus: 'true' },
    })
    await wrapper.get('section li button').trigger('click')
    expect(wrapper.emitted('apply')?.[0]?.[0]).toMatchObject({
      q: 'invoice',
      action: ['junk'],
      virus: 'true',
    })
    await wrapper.get('section > button').trigger('click')
    expect(wrapper.emitted('apply')?.[1]?.[0]).toEqual({ ...NO_FILTERS, q: 'invoice', action: [] })
  })
})
