// The alias filters (T033, FR-011, FR-013): the domain pickers (domains and alias domains for
// "Domain", domains for "Target domain"), the delivers-to mailbox picker, kind and destination type
// with legacy's labels, the flags, the groupware filter only with the groupware, and "clear all".
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import AliasFilters from '@/features/aliases/components/AliasFilters.vue'
import type { AliasListFilters } from '@/features/aliases/list-state'
import { loadLegacy, resetLegacy } from '@/i18n/legacy'

import { mountWithApp } from '../../support/mount'

const NONE: AliasListFilters = {
  q: undefined,
  domain: [],
  primaryDomain: [],
  kind: [],
  destinationType: [],
  destination: undefined,
  active: undefined,
  senderAllowed: undefined,
  groupwareVisible: undefined,
  internal: undefined,
}

beforeEach(async () => {
  await loadLegacy('en-gb')
})
afterEach(() => resetLegacy())

const mountFilters = (groupwareEnabled: boolean | undefined, activeCount = 0) =>
  mountWithApp(AliasFilters, {
    props: { filters: NONE, activeCount, groupwareEnabled, labels: {} },
  })

describe('AliasFilters', () => {
  it('offers the pickers, the kinds and destination types with legacy texts, and the flags', async () => {
    const wrapper = mountFilters(true, 2)
    expect(wrapper.get('button').text()).toBe('Filters (2)')
    const comboboxes = wrapper.findAll('[role="combobox"]')
    expect(comboboxes).toHaveLength(3)
    expect(wrapper.text()).toContain('Catch-All')
    expect(wrapper.text()).toContain('Learn as spam')
    expect(wrapper.text()).toContain('Silently discard mail')
    expect(wrapper.find('#alias-filter-groupwareVisible').exists()).toBe(true)
    await wrapper.findAll('input[type="checkbox"]')[1]!.setValue(true)
    expect(wrapper.emitted('update')?.[0]).toEqual([{ kind: ['catchAll'] }])
    await wrapper.get('#alias-filter-active').setValue('false')
    expect(wrapper.emitted('update')?.[1]).toEqual([{ active: 'false' }])
  })

  it('has no groupware filter while the groupware is disabled or unknown', () => {
    expect(mountFilters(false).find('#alias-filter-groupwareVisible').exists()).toBe(false)
    expect(mountFilters(undefined).find('#alias-filter-groupwareVisible').exists()).toBe(false)
  })
})
