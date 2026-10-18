// The bulk confirmations (UI 002 T073, FR-045, FR-047).
import { describe, expect, it } from 'vitest'

import BulkDeactivateList from '@/features/domains/components/delete/BulkDeactivateList.vue'
import BulkDeleteImpact from '@/features/domains/components/delete/BulkDeleteImpact.vue'

import { mountWithApp } from '../../support/mount'
import { domain } from './domain-fixture'

describe('BulkDeleteImpact', () => {
  it('lists each domain with its impact from the list data, the rule for administrators and the skipped domains', () => {
    const wrapper = mountWithApp(BulkDeleteImpact, {
      props: {
        deletable: [
          domain({ name: 'a.example', unicodeName: 'a.example', domainAdmins: ['reseller'] }),
        ],
        skipped: [domain({ name: 'busy.example', unicodeName: 'busy.example' })],
      },
    })
    const item = wrapper.get('[data-bulk-impact="a.example"]')
    expect(item.text()).toContain('aliases: 380')
    expect(item.text()).toContain('alias domains: 2')
    expect(item.text()).toContain('reseller')
    expect(wrapper.text()).toContain('left without any domain are deleted')
    expect(wrapper.text()).toContain('DKIM keys are kept')
    const skipped = wrapper.get('[data-bulk-skipped]')
    expect(skipped.text()).toContain('busy.example')
    expect(skipped.text()).toContain('mailboxes (8)')
  })
})

describe('BulkDeactivateList', () => {
  it('lists the domains and the effect on their mailboxes', () => {
    const wrapper = mountWithApp(BulkDeactivateList, {
      props: {
        domains: [domain({ unicodeName: 'a.example' }), domain({ unicodeName: 'b.example' })],
      },
    })
    expect(wrapper.findAll('li').map((li) => li.text())).toEqual(['a.example', 'b.example'])
    expect(wrapper.text()).toContain('can no longer sign in')
  })
})
