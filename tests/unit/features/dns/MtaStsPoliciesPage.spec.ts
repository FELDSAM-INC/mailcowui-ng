// The MTA-STS policies overview (T066, FR-054 to FR-056): every policy in scope as a card or a
// table row with the readable domain, the active badge, mode, MX hosts, max age and identifier,
// linking to the domain page's MTA-STS section.
import { describe, expect, it } from 'vitest'

import MtaStsPolicyCard from '@/features/dns/components/MtaStsPolicyCard.vue'
import MtaStsPolicyTable from '@/features/dns/components/MtaStsPolicyTable.vue'

import { mountWithApp } from '../../support/mount'
import { mtaStsRouter, policy, settle } from './mta-sts-fixtures'

describe('MTA-STS policy entries', () => {
  it('shows every FR-055 value on a card linking to the section', async () => {
    const router = mtaStsRouter()
    const wrapper = mountWithApp(MtaStsPolicyCard, {
      props: {
        policy: policy({ domain: 'xn--bcher-kva.example', displayDomain: 'bücher.example' }),
      },
      global: { plugins: [router] },
    })
    await settle()
    expect(wrapper.element.tagName).toBe('LI')
    const heading = wrapper.get('h3')
    expect(heading.text()).toContain('bücher.example')
    expect(heading.get('a').attributes('href')).toBe('/domains/xn--bcher-kva.example#mta-sts')
    for (const value of ['Active', 'enforce', 'mail.example.org', '604,800', '20261018100000']) {
      expect(wrapper.text()).toContain(value)
    }
  })

  it('has a table with sortable headers', async () => {
    const router = mtaStsRouter()
    const wrapper = mountWithApp(MtaStsPolicyTable, {
      props: {
        policies: [
          policy(),
          policy({ domain: 'example.net', displayDomain: 'example.net', active: false }),
        ],
        sort: 'domain',
        order: 'asc',
      },
      global: { plugins: [router] },
    })
    await settle()
    const domain = wrapper.findAll('th').find((th) => th.text().includes('Domain'))!
    expect(domain.attributes('aria-sort')).toBe('ascending')
    const id = wrapper.findAll('th').find((th) => th.text().includes('Policy identifier'))!
    await id.get('button').trigger('click')
    expect(wrapper.emitted('sort')?.[0]).toEqual(['policyId', 'asc'])
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('Inactive')
  })
})
