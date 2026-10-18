// The read-only parts of the domain page (UI 002 T036, FR-015, FR-016).
import { describe, expect, it } from 'vitest'

import DomainAdminsList from '@/features/domains/components/detail/DomainAdminsList.vue'
import UsageSummary from '@/features/domains/components/detail/UsageSummary.vue'

import { mountWithApp } from '../../support/mount'
import { domain } from './domain-fixture'

const plain = (text: string) => text.replace(/[  ]/g, ' ')

describe('UsageSummary', () => {
  it('shows the figures of the classic domain list with its labels, in binary units', () => {
    const text = plain(mountWithApp(UsageSummary, { props: { domain: domain() } }).text())
    for (const value of [
      'Statistics',
      'Mailboxes',
      '8 of 10',
      'Aliases',
      '380 of 400',
      'Quota',
      '9.5 GiB of 10 GiB',
      '7.3 GiB',
      'Message #',
      '12,345',
      'Max. size of a mailbox',
      '2 GiB',
    ]) {
      expect(text).toContain(value)
    }
  })
})

describe('DomainAdminsList', () => {
  it('lists the usernames under the classic label, or says "No record"', () => {
    expect(
      mountWithApp(DomainAdminsList, { props: { admins: ['helper', 'reseller'] } }).text(),
    ).toContain('Domain administrators')
    expect(mountWithApp(DomainAdminsList, { props: { admins: [] } }).text()).toContain('No record')
  })
})
