// The template components (UI 002 T081, FR-050, FR-053), which mirror the classic list and forms:
// the columns and their order, the Default mark, the actions, the details, and the fields of the
// add and edit forms in the legacy order with the legacy labels.
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { DomainCapabilities, DomainTemplate } from '@/api'
import TemplateCard from '@/features/domains/components/templates/TemplateCard.vue'
import TemplateEntryActions from '@/features/domains/components/templates/TemplateEntryActions.vue'
import TemplateEntryDetails from '@/features/domains/components/templates/TemplateEntryDetails.vue'
import DomainValueFields from '@/features/domains/components/fields/DomainValueFields.vue'
import TemplateTable from '@/features/domains/components/templates/TemplateTable.vue'
import { newTemplateValues, templateFormValues } from '@/features/domains/template-form'

import { mountWithApp } from '../../support/mount'
import { installMatchMedia } from '../../support/media'

const MIB = 1_048_576
const GIB = 1024 * MIB

const router = () =>
  createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [
      { path: '/domain-templates', name: 'domain-templates', component: { render: () => null } },
      {
        path: '/domain-templates/:templateId',
        name: 'domain-template-detail',
        component: { render: () => null },
      },
    ],
  })
const withRouter = () => ({ global: { plugins: [router()] } })

const template = (overrides: Partial<DomainTemplate> = {}): DomainTemplate => ({
  id: 2,
  name: 'Small',
  isDefault: false,
  tags: ['gold'],
  maxMailboxes: 5,
  maxAliases: 50,
  maxMailboxQuota: 2 * GIB,
  domainQuota: 10 * GIB,
  rateLimit: { value: 10, frame: 'hour' },
  active: true,
  globalAddressList: true,
  backupMx: false,
  relayAllRecipients: false,
  relayUnknownOnly: false,
  dkimSelector: 'dkim',
  dkimKeySize: 2048,
  createdAt: '2026-01-02T09:00:00.000Z',
  modifiedAt: null,
  etag: '"t2"',
  ...overrides,
})

const capabilities: DomainCapabilities = {
  groupwareEnabled: true,
  taggingLimit: 25,
  maxTagLength: 255,
  maxDescriptionLength: 255,
  footerTextMaxBytes: 1_048_576,
  bulkLimit: 100,
  defaultPageSize: 25,
  maxPageSize: 1000,
  quotaUnit: MIB,
  dkim: {
    defaultSelector: 'dkim',
    defaultKeySize: 2048,
    allowedKeySizes: [1024, 2048, 3072, 4096],
    dnsPublicationEnabled: false,
  },
}

describe('TemplateTable', () => {
  it('has the classic columns in order on the widest screens, with aria-sort on ID and template', () => {
    installMatchMedia({ '(min-width: 1280px)': true, '(min-width: 1536px)': true })
    const wrapper = mountWithApp(TemplateTable, {
      ...withRouter(),
      props: { templates: [template()], sort: 'name', order: 'asc' },
    })
    const headers = wrapper.findAll('th').map((th) => th.text().replace(/[▲▼]/g, '').trim())
    expect(headers).toEqual([
      'Details',
      'ID',
      'Template',
      'Max. aliases',
      'Max. possible mailboxes',
      'Max. quota per mailbox',
      'Total domain quota',
      'Global Address List',
      'Relay domain',
      'Relay all recipients',
      'Relay unknown mailboxes',
      'Active',
      'Action',
    ])
    const sorted = wrapper.findAll('th[aria-sort]')
    expect(sorted.map((th) => th.attributes('aria-sort'))).toEqual(['none', 'ascending'])
  })

  it('moves the quotas and options into the details on narrower tables, and marks Default', async () => {
    installMatchMedia({ '(min-width: 1280px)': false, '(min-width: 1536px)': false })
    const wrapper = mountWithApp(TemplateTable, {
      ...withRouter(),
      props: {
        templates: [template({ id: 1, name: 'Default', isDefault: true })],
        sort: 'name',
        order: 'asc',
      },
    })
    expect(wrapper.find('[data-column="domainQuota"]').exists()).toBe(false)
    expect(wrapper.find('[data-default-badge]').exists()).toBe(true)
    await wrapper.get('button[aria-expanded]').trigger('click')
    const details = wrapper.get('[data-entry-details]')
    expect(details.find('[data-column="domainQuota"]').text()).toContain('10 GiB')
    expect(details.find('[data-column="relayUnknownOnly"]').exists()).toBe(true)
    expect(details.text()).toContain('10 msgs / hour')
  })
})

describe('TemplateCard and TemplateEntryDetails', () => {
  it('shows every column value and keeps rate limit, selector, key length and tags behind the disclosure', async () => {
    const wrapper = mountWithApp(TemplateCard, { ...withRouter(), props: { template: template() } })
    expect(wrapper.get('h3').text()).toBe('Small')
    expect(wrapper.text()).toContain('Max. possible mailboxes:')
    expect(wrapper.text()).not.toContain('dkim')
    await wrapper.get('button[aria-expanded]').trigger('click')
    expect(wrapper.text()).toContain('dkim')
    expect(wrapper.text()).toContain('gold')
  })

  it('shows "∞" for a template without a rate limit, as the classic list does', () => {
    const wrapper = mountWithApp(TemplateEntryDetails, {
      props: { template: template({ rateLimit: null }) },
    })
    expect(wrapper.text()).toContain('∞')
  })
})

describe('TemplateEntryActions', () => {
  it('offers Edit and Remove, and only Edit for the Default template (FR-053)', async () => {
    const wrapper = mountWithApp(TemplateEntryActions, {
      ...withRouter(),
      props: { template: template() },
    })
    expect(wrapper.text()).toContain('Edit')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('delete')).toHaveLength(1)
    const protectedOne = mountWithApp(TemplateEntryActions, {
      ...withRouter(),
      props: { template: template({ isDefault: true, name: 'Default' }) },
    })
    expect(protectedOne.find('button').exists()).toBe(false)
  })
})

describe('DomainValueFields', () => {
  const labels = (wrapper: ReturnType<typeof mountWithApp>) =>
    wrapper.findAll('label, legend').map((label) => label.text().trim())

  it('has the fields of the classic add form in its order, with its labels', () => {
    const wrapper = mountWithApp(DomainValueFields, {
      props: {
        idPrefix: 'add',
        form: 'templateAdd',
        modelValue: newTemplateValues(capabilities),
        capabilities,
        errorsFor: () => [],
      },
    })
    const found = labels(wrapper)
    const order = [
      'Template',
      'Tags',
      'Max. possible aliases',
      'Max. possible mailboxes',
      'Max. quota per mailbox (MiB)',
      'Total domain quota (MiB)',
      'Global Address List',
      'Active',
      'Rate limit',
      'Selector',
      'DKIM key length (bits)',
      'Relay options',
    ]
    const positions = order.map((text) => found.findIndex((label) => label.startsWith(text)))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(wrapper.get('#add-dkimSelector').element).toHaveProperty('value', 'dkim')
    expect(wrapper.get('#add-rateLimit-value').attributes('placeholder')).toBe('Disabled')
  })

  it('uses the edit form labels, and shows the Default template name read-only', () => {
    const wrapper = mountWithApp(DomainValueFields, {
      props: {
        idPrefix: 'edit',
        form: 'templateEdit',
        modelValue: templateFormValues(template({ id: 1, name: 'Default', isDefault: true })),
        capabilities,
        errorsFor: () => [],
        nameReadonly: true,
      },
    })
    const found = labels(wrapper)
    expect(found).toContain('Max. aliases')
    expect(found).toContain('Domain quota')
    expect(wrapper.get('#edit-name').attributes('readonly')).toBeDefined()
  })

  it('emits each change with the other values kept', async () => {
    const values = newTemplateValues(capabilities)
    const wrapper = mountWithApp(DomainValueFields, {
      props: {
        idPrefix: 'add',
        form: 'templateAdd',
        modelValue: values,
        capabilities,
        errorsFor: (path: string) => (path === 'maxMailboxes' ? ['Too many'] : []),
      },
    })
    await wrapper.get('#add-maxMailboxes').setValue('5')
    expect(wrapper.emitted('update:modelValue')!.at(-1)![0]).toEqual({
      ...values,
      maxMailboxes: '5',
    })
    expect(wrapper.text()).toContain('Too many')
  })
})
