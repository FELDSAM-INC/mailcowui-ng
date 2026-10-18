// Deleting one domain (UI 002 T066, research D20, data-model §7): availability, a fresh preview
// each time, the outcome transitions, and the impact and blocker views.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { Domain, DomainDeletionPreview } from '@/api'
import { fetchDomain } from '@/features/domains/api'
import DeleteBlockers from '@/features/domains/components/delete/DeleteBlockers.vue'
import DeleteImpact from '@/features/domains/components/delete/DeleteImpact.vue'
import {
  deletionAvailability,
  useDomainDeletion,
} from '@/features/domains/composables/useDomainDeletion'
import * as confirmModule from '@/shared/composables/useConfirm'

import { mockDomain } from '../../../mocks/factories/domain'
import { mockState, useScenario } from '../../../mocks/node'
import { assignDomains } from '../../../mocks/scenarios/domains-base'
import { mountWithApp } from '../../support/mount'
import { domain as domainFixture } from './domain-fixture'

const preview = (overrides: Partial<DomainDeletionPreview> = {}): DomainDeletionPreview => ({
  domain: 'gone.example',
  allowed: true,
  blockers: { mailboxes: { count: 0, addresses: [] }, resources: { count: 0, addresses: [] } },
  removals: {
    aliasDomains: ['alias-of-gone.example'],
    aliases: { count: 2, addresses: ['info@gone.example', 'sales@gone.example'] },
    footer: true,
  },
  domainAdminsToDelete: ['solo'],
  dkimKeyKept: true,
  etag: '"p"',
  ...overrides,
})

describe('deletionAvailability', () => {
  it('is unavailable while mailboxes or resources are in use', () => {
    expect(
      deletionAvailability(
        domainFixture({ usage: { ...domainFixture().usage, mailboxes: 0, resources: 0 } }),
      ).available,
    ).toBe(true)
    const busy = deletionAvailability(
      domainFixture({ usage: { ...domainFixture().usage, mailboxes: 3, resources: 1 } }),
    )
    expect(busy).toEqual({ available: false, mailboxes: 3, resources: 1 })
  })
})

describe('DeleteImpact', () => {
  it('lists every item of FR-042, with the alias addresses behind a disclosure', () => {
    const wrapper = mountWithApp(DeleteImpact, {
      props: {
        preview: preview(),
        domain: domainFixture({
          name: 'gone.example',
          unicodeName: 'gone.example',
          domainAdmins: ['reseller', 'solo'],
        }),
      },
    })
    const text = wrapper.text()
    expect(text).toContain('gone.example')
    expect(text).toContain('alias-of-gone.example')
    expect(text).toContain('Aliases removed: 2')
    expect(text).toContain('reseller, solo')
    expect(wrapper.get('[data-impact="adminsToDelete"]').text()).toContain('solo')
    expect(text).toContain('The footer is removed.')
    expect(text).toContain('The tags and the stored mail of the domain are removed.')
    expect(text).toContain('The DKIM key is kept.')
    expect(wrapper.get('details summary').text()).toBe('Show the aliases')
    expect(wrapper.get('details').text()).toContain('sales@gone.example')
  })

  it('shows a notice after an outdated deletion and leaves out what does not apply', () => {
    const wrapper = mountWithApp(DeleteImpact, {
      props: {
        preview: preview({
          removals: { aliasDomains: [], aliases: { count: 0, addresses: [] }, footer: false },
          domainAdminsToDelete: [],
          dkimKeyKept: false,
        }),
        domain: domainFixture({ domainAdmins: [] }),
        notice: 'The domain was changed in the meantime.',
      },
    })
    expect(wrapper.text()).toContain('The domain was changed in the meantime.')
    expect(wrapper.text()).not.toContain('The footer is removed.')
    expect(wrapper.text()).not.toContain('DKIM')
  })
})

describe('DeleteBlockers', () => {
  it('names the counts and up to 100 addresses', () => {
    const wrapper = mountWithApp(DeleteBlockers, {
      props: {
        preview: preview({
          allowed: false,
          blockers: {
            mailboxes: {
              count: 150,
              addresses: Array.from({ length: 100 }, (_, i) => `user${i}@gone.example`),
            },
            resources: { count: 1, addresses: ['room@gone.example'] },
          },
        }),
      },
    })
    expect(wrapper.text()).toContain('mailboxes (150)')
    expect(wrapper.text()).toContain('resources (1)')
    expect(wrapper.findAll('li')).toHaveLength(101)
  })
})

describe('useDomainDeletion', () => {
  async function setup() {
    const state = useScenario('admin-active')
    state.domains = [
      mockDomain({ name: 'gone.example' }),
      mockDomain({
        name: 'busy.example',
        usage: {
          mailboxes: 1,
          resources: 0,
          aliases: 0,
          largestMailboxQuota: 0,
          quotaAllocated: 0,
          storageUsed: 0,
          messages: 0,
        },
      }),
    ]
    assignDomains(state, 'solo', ['gone.example'])
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/domains', name: 'domains', component: { render: () => null } },
        { path: '/domains/:domain', name: 'domain-detail', component: { render: () => null } },
      ],
    })
    await router.push('/domains/gone.example')
    let deletion!: ReturnType<typeof useDomainDeletion>
    mountWithApp(
      defineComponent({ setup: () => ((deletion = useDomainDeletion()), () => h('div')) }),
      {
        global: { plugins: [router] },
      },
    )
    return { state, router, deletion: () => deletion }
  }

  it('fetches the preview fresh each time and stops when the confirmation is cancelled', async () => {
    const { deletion } = await setup()
    const ask = vi.spyOn(confirmModule, 'confirm').mockResolvedValue(false)
    const domain: Domain = await fetchDomain('gone.example')
    expect(await deletion().start(domain)).toBe('cancelled')
    expect(await deletion().start(domain)).toBe('cancelled')
    expect(
      mockState().requests.filter((r) => r.operationId === 'previewDomainDeletion'),
    ).toHaveLength(2)
    expect(ask.mock.calls[0]![0].requireTyped?.accepted).toEqual(['gone.example', 'gone.example'])
  })

  it('deletes with the preview version and goes to the list', async () => {
    const { deletion, router } = await setup()
    vi.spyOn(confirmModule, 'confirm').mockResolvedValue(true)
    expect(await deletion().start(await fetchDomain('gone.example'))).toBe('deleted')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('domains')
    const [request] = mockState().requests.filter((r) => r.operationId === 'deleteDomain')
    expect(request!.headers['if-match']).toMatch(/^"/)
  })

  it('shows the blockers when the preview refuses, and confirms again after a 412', async () => {
    const { state, deletion } = await setup()
    const ask = vi.spyOn(confirmModule, 'confirm')
    ask.mockResolvedValueOnce(false)
    state.domains[0]!.usage.mailboxes = 2
    expect(await deletion().start(await fetchDomain('gone.example'))).toBe('blocked')
    expect(ask.mock.calls[0]![0].alertOnly).toBe(true)
    state.domains[0]!.usage.mailboxes = 0
    ask.mockImplementationOnce(() => {
      state.domains[0]!.description = 'Changed'
      return Promise.resolve(true)
    })
    ask.mockResolvedValueOnce(true)
    expect(await deletion().start(await fetchDomain('gone.example'))).toBe('deleted')
    expect(ask).toHaveBeenCalledTimes(3)
    // A first write of a test may be replayed once with a fresh anti-forgery token (403 first).
    const answered = mockState().requests.filter(
      (r) => r.operationId === 'deleteDomain' && r.status !== 403,
    )
    expect(answered.map((r) => r.status)).toEqual([412, 204])
  })

  it('reports a domain that is not empty or gone, and a temporary failure with a retry', async () => {
    const { state, deletion } = await setup()
    const ask = vi.spyOn(confirmModule, 'confirm')
    ask.mockImplementationOnce(() => {
      state.domains[0]!.usage.mailboxes = 1
      return Promise.resolve(true)
    })
    ask.mockResolvedValueOnce(false)
    expect(await deletion().start(await fetchDomain('gone.example'))).toBe('refused')
    state.domains[0]!.usage.mailboxes = 0
    ask.mockImplementationOnce(() => {
      state.domainFailures['gone.example'] = { status: 503, type: 'temporary-failure', times: 1 }
      return Promise.resolve(true)
    })
    ask.mockResolvedValueOnce(true)
    expect(await deletion().start(await fetchDomain('gone.example'))).toBe('deleted')
    ask.mockImplementationOnce(() => {
      state.domains = state.domains.filter((d) => d.name !== 'busy.example')
      return Promise.resolve(true)
    })
    ask.mockResolvedValueOnce(false)
    state.domains = [mockDomain({ name: 'busy.example' })]
    const busy = await fetchDomain('busy.example')
    expect(await deletion().start(busy)).toBe('gone')
  })
})
