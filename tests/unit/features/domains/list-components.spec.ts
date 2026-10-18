// The domain list components (UI 002 T036, FR-006 to FR-011, FR-072, FR-076).
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import ActiveBadge from '@/features/domains/components/list/ActiveBadge.vue'
import DomainCard from '@/features/domains/components/list/DomainCard.vue'
import DomainEntryDetails from '@/features/domains/components/list/DomainEntryDetails.vue'
import DomainFilters from '@/features/domains/components/list/DomainFilters.vue'
import DomainNameText from '@/features/domains/components/list/DomainNameText.vue'
import DomainSortControl from '@/features/domains/components/list/DomainSortControl.vue'
import DomainTable from '@/features/domains/components/list/DomainTable.vue'
import RelayBadge from '@/features/domains/components/list/RelayBadge.vue'
import UsageMeter from '@/features/domains/components/list/UsageMeter.vue'

import { mountWithApp } from '../../support/mount'
import { domain } from './domain-fixture'

const router = () =>
  createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [
      { path: '/domains', name: 'domains', component: { render: () => null } },
      { path: '/domains/:domain', name: 'domain-detail', component: { render: () => null } },
    ],
  })

const withRouter = { global: { plugins: [router()] } }
const plain = (text: string) => text.replace(/[  ]/g, ' ')

describe('UsageMeter', () => {
  it('shows the pair as text, the level by text and icon, and an aria-hidden bar', () => {
    const wrapper = mountWithApp(UsageMeter, {
      props: { label: 'Aliases', used: 380, limit: 400, kind: 'count', usageId: 'aliases' },
    })
    expect(wrapper.text()).toContain('380 of 400')
    expect(wrapper.text()).toContain('Nearly full')
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.get('[data-bar]').attributes('aria-hidden')).toBe('true')
    const over = mountWithApp(UsageMeter, {
      props: { label: 'Mailboxes', used: 12, limit: 10, kind: 'count', usageId: 'mailboxes' },
    })
    expect(over.text()).toContain('Over the limit')
    const sizes = mountWithApp(UsageMeter, {
      props: {
        label: 'Quota',
        used: 9.5 * 1024 ** 3,
        limit: 10 * 1024 ** 3,
        kind: 'size',
        usageId: 'quota',
      },
    })
    expect(plain(sizes.text())).toContain('9.5 GiB of 10 GiB')
    const ok = mountWithApp(UsageMeter, {
      props: { label: 'Mailboxes', used: 1, limit: 10, kind: 'count', usageId: 'mailboxes' },
    })
    expect(ok.text()).not.toContain('Nearly full')
  })
})

describe('badges and names', () => {
  it('names the active state and the relay mode by text', () => {
    expect(mountWithApp(ActiveBadge, { props: { active: true } }).text()).toBe('Active')
    expect(mountWithApp(ActiveBadge, { props: { active: false } }).text()).toBe('Inactive')
    expect(
      mountWithApp(RelayBadge, {
        props: { domain: { backupMx: true, relayAllRecipients: false, relayUnknownOnly: false } },
      }).text(),
    ).toBe('Relay domain')
    expect(
      mountWithApp(RelayBadge, {
        props: { domain: { backupMx: true, relayAllRecipients: true, relayUnknownOnly: true } },
      }).text(),
    ).toBe('Relay unknown mailboxes')
    expect(
      mountWithApp(RelayBadge, {
        props: { domain: { backupMx: false, relayAllRecipients: false, relayUnknownOnly: false } },
      }).text(),
    ).toBe('')
  })

  it('shows the readable name first and the ASCII name below it when they differ', () => {
    const idn = mountWithApp(DomainNameText, {
      props: { name: 'xn--mnchen-3ya.de', unicodeName: 'münchen.de' },
    })
    expect(idn.text()).toContain('münchen.de')
    expect(idn.text()).toContain('xn--mnchen-3ya.de')
    const ascii = mountWithApp(DomainNameText, {
      props: { name: 'a.example', unicodeName: 'a.example' },
    })
    expect(ascii.text()).toBe('a.example')
  })
})

describe('DomainCard', () => {
  it('has the name as heading with a link, the values, tag filter buttons and "+n"', async () => {
    const many = Array.from({ length: 12 }, (_, i) => `t${i}`)
    const wrapper = mountWithApp(DomainCard, {
      ...withRouter,
      props: { domain: domain({ tags: many }), canSeeDomainAdmins: true },
    })
    await flushPromises()
    expect(wrapper.get('h3').text()).toContain('nearly.example')
    expect(wrapper.get('h3 a').attributes('href')).toBe('/ng/domains/nearly.example')
    expect(wrapper.text()).toContain('8 of 10')
    expect(plain(wrapper.text())).toContain('7.3 GiB')
    expect(wrapper.text()).toContain('12,345')
    const tags = wrapper
      .findAll('button')
      .filter((b) => b.attributes('aria-label')?.startsWith('Filter by tag'))
    expect(tags).toHaveLength(5)
    expect(wrapper.text()).toContain('+7')
    await tags[0]!.trigger('click')
    expect(wrapper.emitted('filterTag')).toEqual([['t0']])
  })

  it('reveals the remaining values in an expandable part', async () => {
    const wrapper = mountWithApp(DomainCard, {
      ...withRouter,
      props: { domain: domain(), canSeeDomainAdmins: true },
    })
    const toggle = wrapper.get('button[aria-label="Details of nearly.example"]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[data-entry-details]').text()).toContain('Domain administrators')
  })
})

describe('DomainTable', () => {
  it('has header cells, aria-sort on the sorted column and sorts from the headers', async () => {
    const wrapper = mountWithApp(DomainTable, {
      ...withRouter,
      props: { domains: [domain()], sort: 'storageUsed', order: 'desc', canSeeDomainAdmins: true },
    })
    const headers = wrapper.findAll('th')
    expect(headers.length).toBeGreaterThan(5)
    const storage = headers.find((th) => th.text().includes('Storage used'))!
    expect(storage.attributes('aria-sort')).toBe('descending')
    const mailboxes = headers.find((th) => th.text().includes('Mailboxes'))!
    expect(mailboxes.attributes('aria-sort')).toBe('none')
    await mailboxes.get('button').trigger('click')
    expect(wrapper.emitted('sort')).toEqual([['mailboxes', 'asc']])
    await storage.get('button').trigger('click')
    expect(wrapper.emitted('sort')!.at(-1)).toEqual(['storageUsed', 'asc'])
  })

  it('expands a row with aria-expanded', async () => {
    const wrapper = mountWithApp(DomainTable, {
      ...withRouter,
      props: { domains: [domain()], sort: 'name', order: 'asc', canSeeDomainAdmins: false },
    })
    const toggle = wrapper.get('button[aria-label="Details of nearly.example"]')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[data-entry-details]').text()).not.toContain('Domain administrators')
  })
})

describe('DomainEntryDetails', () => {
  it('lists the values that are not columns', () => {
    const wrapper = mountWithApp(DomainEntryDetails, {
      props: {
        domain: domain({ rateLimit: { value: 10, frame: 'hour' }, backupMx: true }),
        canSeeDomainAdmins: true,
      },
    })
    const text = plain(wrapper.text())
    expect(text).toContain('Relay this domain')
    expect(text).toContain('Yes')
    expect(text).toContain('helper, reseller')
    expect(text).toContain('Never')
    expect(text).toContain('10 msgs / hour')
    expect(text).toContain('2 GiB')
    expect(text).not.toContain('Default mailbox')
  })
})

describe('DomainFilters', () => {
  it('shows the number of active filters and clears them all', async () => {
    const wrapper = mountWithApp(DomainFilters, {
      props: { active: 'inactive', relay: undefined, tags: ['gold'], activeCount: 2 },
    })
    const toggle = wrapper.get('button[aria-expanded]')
    expect(toggle.text()).toBe('Filters (2)')
    await toggle.trigger('click')
    await wrapper.get('select#domain-filter-active').setValue('active')
    expect(wrapper.emitted('update')!.at(-1)).toEqual([{ active: 'active' }])
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Clear all filters')!
      .trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })
})

describe('DomainSortControl', () => {
  it('offers the 14 sort keys and both orders', async () => {
    const wrapper = mountWithApp(DomainSortControl, { props: { sort: 'name', order: 'asc' } })
    const options = wrapper.get('select#domain-sort').findAll('option')
    expect(options).toHaveLength(14)
    await wrapper.get('select#domain-sort').setValue('domainQuota')
    expect(wrapper.emitted('change')!.at(-1)).toEqual(['domainQuota', 'asc'])
    await wrapper.get('select#domain-order').setValue('desc')
    expect(wrapper.emitted('change')!.at(-1)).toEqual(['name', 'desc'])
  })
})
