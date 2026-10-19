// The DKIM state badge (T035, FR-086): the classic interface's state texts with an icon, and
// "Incomplete" for a key with missing parts.
import { describe, expect, it } from 'vitest'

import DkimStateBadge from '@/features/dns/components/DkimStateBadge.vue'

import { mountWithApp } from '../../support/mount'
import { dkimEntry, incompleteEntry, missingEntry, unusedEntry } from './fixtures'

describe('DkimStateBadge', () => {
  it.each([
    [dkimEntry(), 'Key valid'],
    [missingEntry(), 'Key missing'],
    [unusedEntry(), 'Key unused'],
  ])('shows the state text and an icon', (entry, label) => {
    const wrapper = mountWithApp(DkimStateBadge, { props: { entry } })
    expect(wrapper.text()).toBe(label)
    expect(wrapper.find('svg[aria-hidden="true"]').exists()).toBe(true)
  })

  it('adds "Incomplete" for a key with missing parts', () => {
    const wrapper = mountWithApp(DkimStateBadge, { props: { entry: incompleteEntry() } })
    expect(wrapper.text()).toContain('Key valid')
    expect(wrapper.text()).toContain('Incomplete')
    expect(wrapper.findAll('svg[aria-hidden="true"]')).toHaveLength(2)
  })
})
