// The mailbox template components (UI 003 T104, T107 under the forms rule): the shared value fields
// in legacy order with the groupware switch, the flags' locks and the quota slot; the card with the
// one-line protocol summary and the forced flags as text; the table's classic columns by width with
// the sortable headers; the entry actions; and the child row's values.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { MailboxCapabilities } from '@/api'
import MailboxValueFields from '@/features/mailboxes/components/fields/MailboxValueFields.vue'
import TemplateCard from '@/features/mailboxes/components/templates/TemplateCard.vue'
import TemplateEntryActions from '@/features/mailboxes/components/templates/TemplateEntryActions.vue'
import TemplateEntryDetails from '@/features/mailboxes/components/templates/TemplateEntryDetails.vue'
import TemplateTable from '@/features/mailboxes/components/templates/TemplateTable.vue'
import { valuesFrom } from '@/features/mailboxes/form-values'
import type { MailboxTemplate } from '@/features/mailboxes/types'

import { defaultMailboxCapabilities } from '../../../../mocks/scenarios/mailboxes/base'
import { mountWithApp } from '../../../support/mount'
import { installMatchMedia } from '../../../support/media'

const GIB = 1024 ** 3

const router = () =>
  createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [
      {
        path: '/mailbox-templates/:templateId',
        name: 'mailbox-template-detail',
        component: { render: () => null },
      },
    ],
  })
const withRouter = () => ({ global: { plugins: [router()] } })

const capabilities = (overrides: Partial<MailboxCapabilities> = {}): MailboxCapabilities => ({
  ...defaultMailboxCapabilities(),
  ...overrides,
})

const template = (overrides: Partial<MailboxTemplate> = {}): MailboxTemplate => ({
  ...capabilities().templateDefaults,
  id: 3,
  name: 'Staff',
  isDefault: false,
  quota: 5 * GIB,
  tags: ['staff', 'office'],
  quarantineNotification: 'daily',
  quarantineCategory: 'all',
  protocolAccess: {
    imap: true,
    pop3: false,
    smtp: true,
    sieve: true,
    activeSync: false,
    dav: true,
  },
  rateLimit: { value: 100, frame: 'hour' },
  forceSecondFactorSetup: true,
  status: 'inactive',
  createdAt: '2026-01-04T09:00:00.000Z',
  modifiedAt: null,
  etag: '"t3"',
  ...overrides,
})

describe('MailboxValueFields', () => {
  const mountFields = (props: Record<string, unknown> = {}, slots = {}) =>
    mountWithApp(MailboxValueFields, {
      props: {
        idPrefix: 'v',
        modelValue: valuesFrom(capabilities().templateDefaults),
        capabilities: capabilities(),
        errorsFor: (path: string) => (path === 'quota' ? ['Too big'] : []),
        ...props,
      },
      slots,
    })

  it('shows the classic fields in legacy order with their help, starting with the defaults', () => {
    const wrapper = mountFields()
    const text = wrapper.text()
    const order = [
      'Tags',
      'Quota (MiB)',
      'Set handling for tagged mail',
      'Quarantine notifications',
      'Quarantine notification category',
      'Encryption policy',
      'Allowed protocols for direct user access',
      'ACL',
      'Rate limit',
      'Force password update at next login',
      'Force 2FA enrollment at login',
      'Direct forwarding to SOGo',
    ].map((label) => text.indexOf(label))
    expect(order.every((index) => index >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(wrapper.get<HTMLInputElement>('#v-quota').element.value).toBe('0')
    expect(text).toContain('Too big')
    expect(wrapper.get<HTMLInputElement>('#v-quarantineNotification-hourly').element.checked).toBe(
      true,
    )
    expect(wrapper.findAll('#v-permissions option')).toHaveLength(15)
    expect(wrapper.find('hr').exists()).toBe(true)
  })

  it('emits each change as a new value object', async () => {
    const wrapper = mountFields()
    await wrapper.get('#v-quota').setValue('2048')
    await wrapper.get('#v-quarantineCategory-all').setValue(true)
    await wrapper.get('#v-forceSecondFactorSetup').setValue(true)
    const emitted = wrapper.emitted('update:modelValue')!.map(([value]) => value)
    expect(emitted[0]).toMatchObject({ quota: '2048' })
    expect(emitted[1]).toMatchObject({ quarantineCategory: 'all' })
    expect(emitted[2]).toMatchObject({ forceSecondFactorSetup: true })
  })

  it('leaves out SOGo access when the groupware is disabled', () => {
    const wrapper = mountFields({ capabilities: capabilities({ groupwareEnabled: false }) })
    expect(wrapper.text()).not.toContain('Direct forwarding to SOGo')
  })

  it('locks the protocols, the rate limit and SOGo access by the caller’s flags', () => {
    const values = { ...valuesFrom(capabilities().templateDefaults), rateLimitValue: '10' }
    const wrapper = mountFields({
      modelValue: values,
      gates: {
        protocolAccess: { state: 'readOnly', flag: 'protocolAccess' },
        rateLimit: { state: 'readOnly', flag: 'ratelimit' },
        webmailRedirect: { state: 'readOnly', flag: 'sogoAccess' },
      },
    })
    expect(wrapper.findAll('[data-acl-note]')).toHaveLength(3)
    expect(wrapper.get('[data-locked="v-rateLimit"]').text()).toContain('10 msgs / second')
    expect(wrapper.find('#v-rateLimit-value').exists()).toBe(false)
  })

  it('takes another quota field through the quota slot', () => {
    const wrapper = mountFields({}, { quota: () => h('p', { id: 'custom-quota' }, 'Custom') })
    expect(wrapper.find('#custom-quota').exists()).toBe(true)
    expect(wrapper.find('#v-quota').exists()).toBe(false)
  })
})

describe('TemplateCard', () => {
  it('summarises the protocols on one line and shows the forced flags and status as text', async () => {
    const wrapper = mountWithApp(TemplateCard, { props: { template: template() }, ...withRouter() })
    expect(wrapper.get('h3').text()).toBe('Staff')
    expect(wrapper.get('[data-column="quota"]').text()).toContain('5 GiB')
    expect(wrapper.get('[data-column="protocols"]').text()).toContain('SMTP, IMAP, SIEVE and DAV')
    expect(wrapper.get('[data-column="webmailRedirect"]').text()).toBe('SOGO:✓Yes')
    expect(wrapper.get('[data-column="forceSecondFactorSetup"]').text()).toBe('TFA:✓Yes')
    expect(wrapper.get('[data-column="status"]').text()).toContain('Inactive')
    expect(wrapper.find('[data-default-badge]').exists()).toBe(false)
    await wrapper.get('button[aria-expanded]').trigger('click')
    expect(wrapper.get('[data-entry-details="3"]').text()).toContain('100 msgs / hour')
  })

  it('marks Default and says "none" without any protocol', () => {
    const none = {
      imap: false,
      pop3: false,
      smtp: false,
      sieve: false,
      activeSync: false,
      dav: false,
    }
    const wrapper = mountWithApp(TemplateCard, {
      props: {
        template: template({ id: 1, name: 'Default', isDefault: true, protocolAccess: none }),
      },
      ...withRouter(),
    })
    expect(wrapper.get('[data-default-badge]').text()).toBe('Default')
    expect(wrapper.get('[data-column="protocols"]').text()).toContain('None')
  })
})

describe('TemplateEntryDetails', () => {
  it('shows the child row’s values, "∞" without a rate limit, and the hidden columns', () => {
    const wrapper = mountWithApp(TemplateEntryDetails, {
      props: { template: template({ rateLimit: null }), hidden: ['tlsEnforceInbound', 'pop3'] },
    })
    expect(wrapper.get('[data-column="rateLimit"]').text()).toContain('∞')
    expect(wrapper.get('[data-column="quarantineNotification"]').text()).toContain('Daily')
    expect(wrapper.get('[data-column="quarantineCategory"]').text()).toContain('All categories')
    expect(wrapper.get('[data-column="forcePasswordChange"]').text()).toContain('No')
    expect(wrapper.get('[data-column="tags"]').text()).toContain('office')
    expect(wrapper.get('[data-column="tlsEnforceInbound"]').text()).toContain('No')
    expect(wrapper.get('[data-column="pop3"]').text()).toContain('No')
  })
})

describe('TemplateTable', () => {
  const headers = (wrapper: ReturnType<typeof mountWithApp>) =>
    wrapper.findAll('th').map((th) => th.text())

  it('shows quota and the active state from md, TLS and 2FA from xl, the protocols from 2xl', () => {
    installMatchMedia({ '(min-width: 1280px)': false, '(min-width: 1536px)': false })
    const md = mountWithApp(TemplateTable, {
      props: { templates: [template()], sort: 'name', order: 'asc' },
      ...withRouter(),
    })
    expect(headers(md)).toEqual(['ID', 'Template ▲', 'Quota', 'Active', 'Action'])
    installMatchMedia({ '(min-width: 1280px)': true, '(min-width: 1536px)': true })
    const wide = mountWithApp(TemplateTable, {
      props: { templates: [template()], sort: 'id', order: 'desc', actions: false },
      ...withRouter(),
    })
    expect(headers(wide)).toEqual([
      'ID ▼',
      'Template',
      'Quota',
      'Enforce TLS incoming',
      'Enforce TLS outgoing',
      'SMTP',
      'IMAP',
      'POP3',
      'SIEVE',
      'EAS',
      'DAV',
      'SOGO',
      'TFA',
      'Active',
      'Details',
    ])
    expect(wide.get('th[aria-sort="descending"]').text()).toContain('ID')
  })

  it.each([true, false])(
    'keeps expansion at the end and accurate colspan with actions=%s',
    async (actions) => {
      installMatchMedia({})
      const wrapper = mountWithApp(TemplateTable, {
        props: { templates: [template()], sort: 'name', order: 'asc', actions, selectable: true },
        slots: {
          select: '<input type="checkbox" />',
          actions: '<button data-action>Edit</button>',
        },
        ...withRouter(),
      })
      const row = wrapper.get('tbody tr[data-entry]')
      expect(row.get('td:first-child input').attributes('type')).toBe('checkbox')
      const controls = row.get('td:last-child .table-row-controls')
      expect(controls.find('[data-action]').exists()).toBe(actions)
      expect(controls.findAll('button')[0]!.attributes('aria-expanded')).toBe('false')
      await controls.get('button[aria-expanded]').trigger('click')
      expect(Number(wrapper.get('[data-entry-details]').attributes('colspan'))).toBe(
        row.findAll('td').length,
      )
    },
  )

  it('sorts from the headers', async () => {
    installMatchMedia({})
    const wrapper = mountWithApp(TemplateTable, {
      props: { templates: [template()], sort: 'name', order: 'asc' },
      ...withRouter(),
    })
    const [idButton, nameButton] = wrapper.findAll('th button')
    await nameButton!.trigger('click')
    await idButton!.trigger('click')
    expect(wrapper.emitted('sort')).toEqual([
      ['name', 'desc'],
      ['id', 'asc'],
    ])
  })
})

describe('TemplateEntryActions', () => {
  it('puts Edit and Remove in a menu, but shows Edit directly for Default', async () => {
    const regular = mountWithApp(TemplateEntryActions, {
      ...withRouter(),
      props: { template: template() },
      attachTo: document.body,
    })
    expect(regular.find('a').exists()).toBe(false)
    const trigger = regular.get('[data-row-action-trigger]')
    await trigger.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    expect(items.map((item) => item.textContent?.trim())).toEqual(['Edit', 'Remove'])
    items[1]!.click()
    await vi.waitFor(() => expect(regular.emitted('delete')).toHaveLength(1))
    expect(document.activeElement).toBe(trigger.element)
    regular.unmount()
    const fallback = mountWithApp(TemplateEntryActions, {
      ...withRouter(),
      props: { template: template({ id: 1, name: 'Default', isDefault: true }) },
    })
    expect(fallback.find('[data-row-action-trigger]').exists()).toBe(false)
    expect(fallback.get('a').text()).toBe('Edit')
    expect(fallback.get('a').attributes('aria-label')).toBe('Edit: Default')
    fallback.unmount()
  })
})
