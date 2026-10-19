// The administrators' read-only server settings (T035, FR-015).
import { describe, expect, it } from 'vitest'

import DkimSettingsSummary from '@/features/dns/components/DkimSettingsSummary.vue'

import { mountWithApp } from '../../support/mount'
import { dnsCapabilities } from './fixtures'

describe('DkimSettingsSummary', () => {
  it('shows the default selector, the default key size, export and publication', () => {
    const wrapper = mountWithApp(DkimSettingsSummary, {
      props: { caps: dnsCapabilities('admin', { selector: 'feldhost', publication: true }) },
    })
    expect(wrapper.text()).toContain('feldhost')
    expect(wrapper.text()).toContain('2,048')
    expect(wrapper.text()).toContain('Private key export')
    expect(wrapper.text()).toContain('Off')
    expect(wrapper.text()).toContain('On')
    expect(wrapper.find('[data-dkim-settings]').attributes('aria-busy')).toBeUndefined()
  })

  it('keeps its place with the labels and placeholders while the settings load (SC-013, no layout shift)', () => {
    const wrapper = mountWithApp(DkimSettingsSummary, { props: { caps: undefined } })
    const section = wrapper.find('[data-dkim-settings]')
    expect(section.exists()).toBe(true)
    expect(section.attributes('aria-busy')).toBe('true')
    expect(wrapper.text()).toContain('Private key export')
    expect(wrapper.findAll('dd [data-placeholder]')).toHaveLength(4)
    expect(wrapper.text()).not.toContain('Off')
  })
})
