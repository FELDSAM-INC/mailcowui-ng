// The MTA-STS section of an alias domain page (T068, FR-022): it names the target domain and links
// to its MTA-STS section, and offers no editing.
import { describe, expect, it } from 'vitest'

import AliasDomainMtaStsSection from '@/features/dns/components/AliasDomainMtaStsSection.vue'

import { mountWithApp } from '../../support/mount'
import { mtaStsRouter, settle } from './mta-sts-fixtures'

describe('AliasDomainMtaStsSection', () => {
  it('names the target, links to its MTA-STS section and offers no editing', async () => {
    const router = mtaStsRouter()
    await router.push('/')
    const wrapper = mountWithApp(AliasDomainMtaStsSection, {
      props: { aliasDomain: 'example.com', targetDomain: 'example.org' },
      global: { plugins: [router] },
    })
    await settle()
    expect(wrapper.get('h2').text()).toBe('MTA-STS')
    expect(wrapper.text()).toContain('example.com')
    expect(wrapper.text()).toContain('example.org')
    expect(wrapper.get('a').attributes('href')).toBe('/domains/example.org#mta-sts')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
