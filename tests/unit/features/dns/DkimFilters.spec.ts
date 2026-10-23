import { installMatchMedia } from '../../support/media'
// The DKIM list filters (T035, FR-009, US1-AS6): the classic state toggles as filters, kind and
// completeness, the selector and domain chips, the active count and "clear all"; administrators
// only get "Key unused" and "No domain".
import { describe, expect, it } from 'vitest'

import DkimFilters from '@/features/dns/components/DkimFilters.vue'

import { mountWithApp } from '../../support/mount'

const base = {
  states: [] as ('valid' | 'missing' | 'unused')[],
  kind: undefined,
  complete: undefined,
  selector: undefined,
  domain: undefined,
  activeCount: 0,
}

describe('DkimFilters', () => {
  it('offers every option to administrators', async () => {
    installMatchMedia({ '(min-width: 768px)': true })
    const wrapper = mountWithApp(DkimFilters, { props: { ...base, role: 'admin' } })
    await wrapper.get('[aria-controls="dkim-filters"]').trigger('click')
    const labels = wrapper.findAll('label').map((label) => label.text())
    expect(labels).toEqual(expect.arrayContaining(['Key valid', 'Key missing', 'Key unused']))
    expect(wrapper.get('#dkim-filter-kind').text()).toContain('No domain')
  })

  it('leaves out "Key unused" and "No domain" for domain administrators', async () => {
    installMatchMedia({ '(min-width: 768px)': true })
    const wrapper = mountWithApp(DkimFilters, { props: { ...base, role: 'domainAdmin' } })
    await wrapper.get('[aria-controls="dkim-filters"]').trigger('click')
    expect(wrapper.text()).not.toContain('Key unused')
    expect(wrapper.get('#dkim-filter-kind').text()).not.toContain('No domain')
  })

  it('updates states, kind and completeness and clears everything', async () => {
    installMatchMedia({ '(min-width: 768px)': true })
    const wrapper = mountWithApp(DkimFilters, { props: { ...base, role: 'admin' } })
    await wrapper.get('[aria-controls="dkim-filters"]').trigger('click')
    await wrapper.get('input[value="missing"]').setValue(true)
    expect(wrapper.emitted('update')?.[0]).toEqual([{ state: ['missing'] }])
    await wrapper.get('#dkim-filter-kind').setValue('aliasDomain')
    expect(wrapper.emitted('update')?.[1]).toEqual([{ kind: 'aliasDomain' }])
    await wrapper.get('#dkim-filter-complete').setValue('false')
    expect(wrapper.emitted('update')?.[2]).toEqual([{ complete: 'false' }])
    await wrapper.get('#dkim-filter-selector').setValue('shop')
    expect(wrapper.emitted('update')?.[3]).toEqual([{ selector: 'shop' }])
    await wrapper.get('#dkim-filter-selector').setValue('')
    expect(wrapper.emitted('update')?.[4]).toEqual([{ selector: undefined }])
  })

  it('names the active filters and shows selector and domain chips', async () => {
    installMatchMedia({ '(min-width: 768px)': true })
    const wrapper = mountWithApp(DkimFilters, {
      props: {
        ...base,
        role: 'admin',
        states: ['missing'],
        selector: 'dkim',
        domain: 'example.org',
        activeCount: 3,
      },
    })
    expect(wrapper.get('[aria-controls="dkim-filters"]').text()).toContain('3')
    const chips = wrapper.findAll('[data-filter-chips] li')
    expect(chips.map((chip) => chip.text()).join(' ')).toContain('dkim')
    expect(chips.map((chip) => chip.text()).join(' ')).toContain('example.org')
    await wrapper.get('[data-clear-filters]').trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })
})
