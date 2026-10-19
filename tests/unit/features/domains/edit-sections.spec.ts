// The "Edit domain" section of the domain page (UI 002 T058, FR-029 to FR-040, research D11), which
// mirrors the classic Domain tab: its fields in legacy order, the administrator-only fields, the
// client rules and the changed members with If-Match.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { queryKeys, type Domain, type DomainCapabilities } from '@/api'
import { fetchDomain } from '@/features/domains/api'
import DomainSection from '@/features/domains/components/detail/sections/DomainSection.vue'
import RateLimitSection from '@/features/domains/components/detail/sections/RateLimitSection.vue'
import { PATCHABLE_ATTRIBUTES } from '@/features/domains/permissions'

import { mockDomain, GIB } from '../../../mocks/factories/domain'
import { mockState, useScenario } from '../../../mocks/node'
import { defaultDomainCapabilities } from '../../../mocks/scenarios/domains-base'
import { mountWithApp, testPlugins } from '../../support/mount'
import { createTestRouter } from '../../support/router'

const capabilities: DomainCapabilities = { ...defaultDomainCapabilities(), taggingLimit: 3 }
const all = new Set(PATCHABLE_ATTRIBUTES)
const plain = (text: string) => text.replace(/[  ]/g, ' ')

async function domainFixture(): Promise<Domain> {
  const state = useScenario('admin-active')
  state.domains = [
    mockDomain({
      name: 'edit.example',
      description: 'Edit Ltd',
      maxMailboxes: 10,
      maxAliases: 400,
      domainQuota: 50 * GIB,
      maxMailboxQuota: 10 * GIB,
      tags: ['a', 'b'],
      usage: {
        mailboxes: 8,
        resources: 0,
        aliases: 40,
        largestMailboxQuota: 5 * GIB,
        quotaAllocated: 30 * GIB,
        storageUsed: 0,
        messages: 0,
      },
    }),
  ]
  const domain = await fetchDomain('edit.example')
  testPlugins().queryClient.setQueryData(queryKeys.domains.detail('edit.example'), domain)
  return domain
}

function mountSection(component: object, domain: Domain, props: Record<string, unknown> = {}) {
  return mountWithApp(component, {
    attachTo: document.body,
    props: { domain, editableFields: all, editing: true, capabilities, ...props },
    // The relayhost field's History link (UI 009 US9) asks the router for the audit log route.
    global: { plugins: [createTestRouter()] },
  })
}

const updates = () =>
  mockState().requests.filter((request) => request.operationId === 'updateDomain')
const click = async (wrapper: ReturnType<typeof mountWithApp>, text: string) => {
  await wrapper
    .findAll('button')
    .find((button) => button.text() === text)!
    .trigger('click')
  await flushPromises()
}

const adminIdentity = { role: 'admin', permissions: {} } as never
const domainAdminIdentity = {
  role: 'domainAdmin',
  permissions: { domainRelayhost: false },
} as never

const labels = (wrapper: ReturnType<typeof mountWithApp>) =>
  wrapper.findAll('label, legend, dt').map((element) => element.text().trim())

describe('DomainSection', () => {
  it('shows the classic fields in legacy order to an administrator', async () => {
    const domain = await domainFixture()
    const wrapper = mountSection(DomainSection, domain, { identity: adminIdentity })
    // UI 009: the relayhost choice is an async component that reads the assignment.
    await vi.waitFor(() => expect(wrapper.find('input#section-domain-relayhost').exists()).toBe(true))
    const found = labels(wrapper)
    const order = [
      'Domain',
      'Description',
      'Tags',
      'Sender-dependent transports',
      'Max. aliases',
      'Max. possible mailboxes',
      'Max. quota per mailbox (MiB)',
      'Domain quota',
      'Relay options',
      'Global Address List',
      'Active',
    ]
    const positions = order.map((text) => found.findIndex((label) => label.startsWith(text)))
    expect(found, JSON.stringify(found)).toBeDefined()
    expect(positions, JSON.stringify(found)).not.toContain(-1)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(wrapper.get('input#section-domain-domainQuota').element).toHaveProperty('value', '51200')
    await vi.waitFor(() =>
      expect(wrapper.get('input#section-domain-relayhost').element).toHaveProperty(
        'value',
        'None / Inherit',
      ),
    )
  })

  it('shows a domain administrator no limits, quotas or relay options, and the rest as legacy does', async () => {
    const domain = await domainFixture()
    const wrapper = mountSection(DomainSection, domain, {
      identity: domainAdminIdentity,
      editableFields: new Set(['tags', 'globalAddressList']),
    })
    expect(wrapper.find('input#section-domain-maxAliases').exists()).toBe(false)
    expect(wrapper.find('#section-domain-relay-backupMx').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Sender-dependent transports')
    expect(wrapper.get('input#section-domain-description').attributes('readonly')).toBeDefined()
    expect(wrapper.get('input#section-domain-active').attributes('disabled')).toBeDefined()
    expect(
      wrapper.get('input#section-domain-globalAddressList').attributes('disabled'),
    ).toBeUndefined()
  })

  it('refuses a changed limit below the usage and quotas out of order before sending', async () => {
    const domain = await domainFixture()
    const wrapper = mountSection(DomainSection, domain, { identity: adminIdentity })
    await wrapper.get('input#section-domain-maxMailboxes').setValue('5')
    await wrapper.get('input#section-domain-maxMailboxQuota').setValue('61440')
    await click(wrapper, 'Save changes')
    expect(plain(wrapper.text())).toContain('This is below what is in use: 8.')
    expect(wrapper.find('#section-domain-maxMailboxQuota-error').exists()).toBe(true)
    expect(updates()).toHaveLength(0)
  })

  it('refuses a tag set above the tagging limit before sending', async () => {
    const domain = await domainFixture()
    const wrapper = mountSection(DomainSection, domain, { identity: adminIdentity })
    const input = wrapper.get('input#section-domain-tags')
    for (const tag of ['c', 'd']) {
      await input.setValue(tag)
      await input.trigger('keydown', { key: 'Enter' })
    }
    await click(wrapper, 'Save changes')
    expect(wrapper.text()).toContain('3')
    expect(updates()).toHaveLength(0)
  })

  it('sends only the changed members with If-Match and says legacy\'s "Changes to domain … saved"', async () => {
    const domain = await domainFixture()
    const wrapper = mountSection(DomainSection, domain, { identity: adminIdentity })
    await wrapper.get('input#section-domain-maxAliases').setValue('500')
    await wrapper.get('input#section-domain-domainQuota').setValue('61440')
    await click(wrapper, 'Save changes')
    await vi.waitFor(() =>
      expect(updates().filter((r) => r.status !== 403)[0]?.body).toEqual({
        maxAliases: 500,
        domainQuota: 60 * GIB,
      }),
    )
    expect(updates().filter((r) => r.status !== 403)[0]!.headers['if-match']).toBe(domain.etag)
    await vi.waitFor(() =>
      expect(JSON.stringify(wrapper.emitted('status'))).toContain(
        'Changes to domain edit.example have been saved',
      ),
    )
  })
})

describe('RateLimitSection', () => {
  it('shows the rate limit read-only, or "Disabled"', async () => {
    const domain = await domainFixture()
    const none = mountWithApp(RateLimitSection, { props: { domain } })
    expect(none.text()).toContain('Disabled')
    expect(none.find('button').exists()).toBe(false)
    const limited = mountWithApp(RateLimitSection, {
      props: { domain: { ...domain, rateLimit: { value: 10, frame: 'hour' } } },
    })
    expect(limited.text()).toContain('10 msgs / hour')
  })
})
