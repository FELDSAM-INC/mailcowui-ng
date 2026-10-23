// The mailbox list components (UI 003 T052, FR-007, FR-008, FR-010, FR-013, FR-075): the card
// opens the mailbox with separate actions; the table's legacy headers, `aria-sort` and optional
// columns; the filters' panel, statuses and sources labelled with the product name.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { fetchMailboxes } from '@/features/mailboxes/api'
import { COLUMNS } from '@/features/mailboxes/columns'
import ColumnChooser from '@/features/mailboxes/components/list/ColumnChooser.vue'
import MailboxCard from '@/features/mailboxes/components/list/MailboxCard.vue'
import MailboxFilters from '@/features/mailboxes/components/list/MailboxFilters.vue'
import MailboxRowActions from '@/features/mailboxes/components/list/MailboxRowActions.vue'
import MailboxSortControl from '@/features/mailboxes/components/list/MailboxSortControl.vue'
import MailboxTable from '@/features/mailboxes/components/list/MailboxTable.vue'
import { NO_FILTERS } from '@/features/mailboxes/list-state'

import { useScenario } from '../../../../../mocks/node'
import { installMatchMedia } from '../../../../support/media'
import { mountWithApp } from '../../../../support/mount'

const router = () =>
  createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [
      { path: '/mailboxes', name: 'mailboxes', component: { render: () => null } },
      {
        path: '/mailboxes/:address',
        name: 'mailbox-detail',
        component: { render: () => null },
      },
    ],
  })
const withRouter = () => ({ global: { plugins: [router()] } })

async function mailboxes(q?: string) {
  useScenario('admin-mailboxes-30')
  return (await fetchMailboxes({ limit: 100, offset: 0, ...(q ? { q } : {}) })).data
}

describe('MailboxCard', () => {
  it('opens the mailbox from its address and shows the name, status, quota and messages', async () => {
    const [anna] = await mailboxes('anna@')
    const wrapper = mountWithApp(MailboxCard, {
      props: { mailbox: anna! },
      slots: { actions: '<button type="button">Act</button>' },
      ...withRouter(),
    })
    await flushPromises()
    const link = wrapper.get('h3 a')
    expect(link.text()).toBe('anna@a.example')
    expect(link.attributes('href')).toBe('/ng/mailboxes/anna@a.example')
    expect(wrapper.get('[data-display-name]').text()).toBe('Anna Smith')
    expect(wrapper.get('[data-status]').text()).toBe('Active')
    expect(wrapper.text()).toContain('Quota')
    expect(wrapper.text()).toContain('1,200')
    expect(wrapper.find('h3 button').exists()).toBe(false)
    expect(wrapper.text()).toContain('Act')
    expect(wrapper.get('[data-card-header] button').text()).toBe('Act')
    expect(wrapper.find('[data-entry-details]').exists()).toBe(false)
    await wrapper.get('[data-card-expand]').trigger('click')
    const details = wrapper.get('[data-entry-details]')
    expect(details.text()).toContain('Last mail login')
    expect(details.text()).toContain('SMTP')
    expect(details.findAll('[data-flag]').length).toBeGreaterThan(0)
  })

  it('shows markup in names as text and IDN domains readable', async () => {
    const all = await mailboxes()
    const markup = all.find((mailbox) => mailbox.localPart === 'markup')!
    const wrapper = mountWithApp(MailboxCard, { props: { mailbox: markup }, ...withRouter() })
    expect(wrapper.get('[data-display-name]').text()).toBe('<b>Bold</b>')
    expect(wrapper.find('b').exists()).toBe(false)
    const jana = all.find((mailbox) => mailbox.localPart === 'jana')!
    const idn = mountWithApp(MailboxCard, { props: { mailbox: jana }, ...withRouter() })
    expect(idn.get('h3 a').text()).toBe('jana@bücher.example')
  })
})

describe('MailboxRowActions', () => {
  it('offers Edit and Remove in a menu named for the mailbox, with a stable dialog focus target', async () => {
    const [anna] = await mailboxes('anna@')
    const wrapper = mountWithApp(MailboxRowActions, {
      props: { mailbox: anna!, removable: true },
      attachTo: document.body,
      ...withRouter(),
    })
    await flushPromises()
    const trigger = wrapper.get('[data-row-action-trigger]')
    expect(trigger.attributes('aria-label')).toBe('Actions for anna@a.example')
    await trigger.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const edit = document.querySelector('[role="menuitem"][aria-label="Edit anna@a.example"]')!
    expect(edit.getAttribute('href')).toBe('/ng/mailboxes/anna@a.example')
    const remove = document.querySelector<HTMLElement>(
      '[role="menuitem"][aria-label="Remove anna@a.example"]',
    )!
    remove.click()
    await vi.waitFor(() => expect(wrapper.emitted('remove')).toHaveLength(1))
    expect(wrapper.emitted('remove')?.[0]).toEqual([anna, trigger.element])
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })
})

describe('MailboxTable', () => {
  it('puts secondary fields and full login history behind the final row expander', async () => {
    const query = '(min-width: 1024px) and (hover: hover) and (pointer: fine)'
    const media = installMatchMedia({ [query]: true })
    const list = await mailboxes('anna@')
    const wrapper = mountWithApp(MailboxTable, {
      props: {
        mailboxes: list,
        columns: COLUMNS.filter((column) => column.default),
        sort: 'address',
        order: 'asc',
      },
      ...withRouter(),
    })
    await flushPromises()
    const logins = wrapper.get('[data-cell="lastMailLogin"]')
    expect(logins.find('details').exists()).toBe(false)
    expect(logins.text()).toContain('IMAP @')
    expect(wrapper.find('[data-entry-details]').exists()).toBe(false)
    const expand = wrapper.get('tbody tr > td:last-child [data-row-expand]')
    await expand.trigger('click')
    const details = wrapper.get('[data-entry-details]')
    expect(details.text()).toContain('Anna Smith')
    const protocols = details.findAll('[data-login]').map((line) => line.text())
    expect(protocols.length).toBeGreaterThan(1)
    await expand.trigger('click')
    expect(wrapper.find('[data-entry-details]').exists()).toBe(false)
    media.set(query, false)
    await flushPromises()
    expect(logins.findAll('[data-login]').map((line) => line.text())).toEqual(protocols)
    wrapper.unmount()
  })

  it('has legacy’s headers, sorts from them with aria-sort and shows chosen columns', async () => {
    const list = await mailboxes('anna')
    const columns = COLUMNS.filter((column) => column.default || column.id === 'tags')
    const wrapper = mountWithApp(MailboxTable, {
      props: { mailboxes: list, columns, sort: 'percentUsed', order: 'desc' },
      ...withRouter(),
    })
    await flushPromises()
    const headers = wrapper.findAll('th').map((cell) => cell.text().replace(/[▲▼]/g, '').trim())
    expect(headers).toEqual([
      'Username',
      'Quota',
      'Last mail login',
      'In use (%)',
      'Message #',
      'Active',
      'Tags',
      'Action',
    ])
    expect(wrapper.get('[data-column="inUse"]').attributes('aria-sort')).toBe('descending')
    expect(wrapper.get('[data-column="address"]').attributes('aria-sort')).toBe('none')
    expect(wrapper.get('[data-column="tags"]').attributes('aria-sort')).toBeUndefined()
    await wrapper.get('[data-column="inUse"] button').trigger('click')
    expect(wrapper.emitted('sort')?.[0]).toEqual(['percentUsed', 'asc'])
    await wrapper.get('[data-column="address"] button').trigger('click')
    expect(wrapper.emitted('sort')?.[1]).toEqual(['address', 'asc'])
    const carl = wrapper.get('[data-entry="carl@a.example"]')
    expect(carl.get('[data-cell="tags"]').text()).toBe('Annapolis')
  })

  it('renders every optional column', async () => {
    const list = await mailboxes('ivan')
    const wrapper = mountWithApp(MailboxTable, {
      props: { mailboxes: list, columns: COLUMNS, sort: 'address', order: 'asc' },
      ...withRouter(),
    })
    await flushPromises()
    const row = wrapper.get('[data-entry="ivan@b.example"]')
    expect(row.get('[data-cell="displayName"]').text()).toBe('Ivan LDAP')
    expect(row.get('[data-cell="domain"]').text()).toBe('b.example')
    expect(row.get('[data-cell="authSource"]').text()).toBe('LDAP')
    expect(row.get('[data-cell="tlsEnforceInbound"] [data-flag]').attributes('data-flag')).toBe(
      'off',
    )
    expect(row.get('[data-cell="imap"] [data-flag]').attributes('data-flag')).toBe('on')
    expect(row.get('[data-cell="imap"] .sr-only').text()).toBe('Yes')
    expect(row.get('[data-cell="quarantineNotification"]').text()).toBe('Hourly')
    expect(row.get('[data-cell="quarantineCategory"]').text()).toBe('Rejected')
    expect(row.get('[data-cell="modifiedAt"]').text()).toBe('-')
    expect(row.get('[data-cell="createdAt"]').text()).not.toBe('-')
  })
})

describe('MailboxSortControl', () => {
  it('lists the 12 sort fields with legacy labels and emits the sort and order', async () => {
    const wrapper = mountWithApp(MailboxSortControl, { props: { sort: 'address', order: 'asc' } })
    await flushPromises()
    const options = wrapper.findAll('#mailbox-sort option').map((option) => option.text())
    expect(options).toHaveLength(12)
    expect(options[0]).toBe('Username')
    expect(options).toContain('Storage used')
    await wrapper.get('#mailbox-sort').setValue('messageCount')
    expect(wrapper.emitted('change')?.[0]).toEqual(['messageCount', 'asc'])
    await wrapper.get('#mailbox-order').setValue('desc')
    expect(wrapper.emitted('change')?.[1]).toEqual(['address', 'desc'])
  })
})

describe('MailboxFilters', () => {
  it('opens the panel, emits statuses and sources, and names the built-in source by the product', async () => {
    installMatchMedia({ '(min-width: 768px)': true })
    useScenario('admin-mailboxes-30')
    const wrapper = mountWithApp(MailboxFilters, {
      props: {
        filters: { ...NO_FILTERS, status: ['inactive'] },
        activeCount: 1,
        sources: ['mailcow', 'ldap'],
        labels: {},
      },
    })
    await flushPromises()
    const toggle = wrapper.get('button[aria-controls="mailbox-filters"]')
    expect(toggle.text()).toBe('Filters (1)')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    await wrapper.get('[data-status-filter="active"]').setValue(true)
    expect(wrapper.emitted('update')?.[0]).toEqual([{ status: ['inactive', 'active'] }])
    await wrapper.get('[data-status-filter="inactive"]').setValue(false)
    expect(wrapper.emitted('update')?.[1]).toEqual([{ status: [] }])
    const sources = wrapper
      .findAll('[data-source-filter]')
      .map((input) => input.element.parentElement?.textContent?.trim())
    expect(sources[1]).toBe('LDAP')
    expect(sources[0]).not.toBe('mailcow')
    await wrapper.get('[data-source-filter="ldap"]').setValue(true)
    expect(wrapper.emitted('update')?.[2]).toEqual([{ source: ['ldap'] }])
    expect(wrapper.find('#mailbox-sort').exists()).toBe(false)
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
  })

  it('hides the source filter without an identity provider and shows the sort below md', async () => {
    installMatchMedia({ '(min-width: 768px)': true })
    useScenario('admin-mailboxes-30')
    const wrapper = mountWithApp(MailboxFilters, {
      props: {
        filters: NO_FILTERS,
        activeCount: 0,
        sources: ['mailcow'],
        labels: {},
        showSort: true,
      },
    })
    await flushPromises()
    expect(wrapper.get('button[aria-controls="mailbox-filters"]').text()).toBe('Filters')
    expect(wrapper.find('[data-source-filter]').exists()).toBe(false)
    expect(wrapper.find('#mailbox-sort').exists()).toBe(false)
  })
})

describe('ColumnChooser', () => {
  it('offers legacy’s row details as checkbox items', async () => {
    const wrapper = mountWithApp(ColumnChooser, {
      props: { modelValue: ['domain'] },
      attachTo: document.body,
    })
    await wrapper.get('button').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const items = [...document.body.querySelectorAll('[data-column-option]')]
    expect(items.length).toBe(17)
    expect(
      document.body.querySelector('[data-column-option="passwordChangedAt"]')?.textContent,
    ).toBe('Last password change')
    const domain = document.body.querySelector('[data-column-option="domain"]')!
    expect(domain.getAttribute('aria-checked')).toBe('true')
    ;(document.body.querySelector('[data-column-option="createdAt"]') as HTMLElement).click()
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['domain', 'createdAt']])
    wrapper.unmount()
  })
})
