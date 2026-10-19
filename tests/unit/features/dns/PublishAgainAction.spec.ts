// "Publish DNS record again" (T097, research R16, FR-045): sends the version tag, writes the result
// and its outcome, and refreshes the capabilities when publication is turned off.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { queryKeys } from '@/api'
import { fetchDkimKey } from '@/features/dns/api/dkim'
import PublishAgainAction from '@/features/dns/components/PublishAgainAction.vue'

import { useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'

const entryOf = (name: string) => fetchDkimKey(name)

describe('PublishAgainAction', () => {
  it('publishes with If-Match and writes the result and its outcome', async () => {
    const state = useScenario('dns-admin-fork')
    const entry = await entryOf('example.org')
    const wrapper = mountWithApp(PublishAgainAction, { props: { entry } })
    await wrapper.get('button').trigger('click')
    await vi.waitFor(() =>
      expect(state.requests.some((r) => r.operationId === 'publishDkimDnsRecord')).toBe(true),
    )
    await flushPromises()
    const sent = state.requests.find((r) => r.operationId === 'publishDkimDnsRecord')!
    expect(sent.headers['if-match']).toBe(entry.etag)
    const { queryClient } = testPlugins()
    expect(queryClient.getQueryData(queryKeys.dkimKeys.outcome('example.org'))).toMatchObject({
      status: 'published',
    })
    expect(wrapper.text()).toContain('Published to the DNS zone')
  })

  it('says publication is off and refreshes the capabilities', async () => {
    const state = useScenario('dns-admin-fork')
    const entry = await entryOf('example.org')
    state.dns.capabilities.dkim.dnsPublicationEnabled = false
    const { queryClient } = testPlugins()
    queryClient.setQueryData(queryKeys.dns.capabilities(), { dkim: {} })
    const wrapper = mountWithApp(PublishAgainAction, { props: { entry } })
    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('DNS publication is turned off'))
    expect(queryClient.getQueryState(queryKeys.dns.capabilities())?.isInvalidated).toBe(true)
    expect(wrapper.emitted('refused')?.[0]?.[0]).toMatchObject({ status: 403 })
  })

  it('leaves the refusal to the page when asked, which keeps it after the action is gone', async () => {
    const state = useScenario('dns-admin-fork')
    const entry = await entryOf('example.org')
    state.dns.capabilities.dkim.dnsPublicationEnabled = false
    const wrapper = mountWithApp(PublishAgainAction, { props: { entry, showRefusal: false } })
    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => expect(wrapper.emitted('refused')).toHaveLength(1))
    expect(wrapper.text()).not.toContain('DNS publication is turned off')
  })
})
