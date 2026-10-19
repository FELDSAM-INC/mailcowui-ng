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
  })
})
