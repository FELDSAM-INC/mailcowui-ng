// The capabilities read of UI 004 (T026, research R5, FR-071): one query for 5 minutes without a
// focus refetch, the contract's page sizes, and the gate around forms and bulk bars.
import { flushPromises } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import { queryKeys, type AliasCapabilities } from '@/api'
import { aliasesCapabilitiesOptions, CapabilitiesGate } from '@/features/aliases'

import contract from '../../../../contract/openapi.json'
import { server } from '../../../mocks/node'
import { mountWithApp, resetTestPlugins } from '../../support/mount'

const CAPS: AliasCapabilities = {
  groupwareEnabled: true,
  externalDestinationsDisabled: false,
  bulkLimit: 100,
  defaultPageSize: 25,
  maxPageSize: 1000,
  commentMaxBytes: 160,
  destinationsMaxLength: 65535,
  resourceDescriptionMaxLength: 255,
  resourceBookingLimit: { min: 1, max: 1000 },
  rateLimitFrames: ['second', 'minute', 'hour', 'day'],
  dkimKeySizes: [1024, 2048, 3072, 4096],
  dkimDefaults: { selector: 'dkim', keySize: 2048 },
  dkimDnsPublicationEnabled: false,
}

describe('aliasesCapabilitiesOptions', () => {
  it('uses one key, 5 minutes and no focus refetch', () => {
    const options = aliasesCapabilitiesOptions()
    expect(options.queryKey).toEqual(queryKeys.capabilities.aliases())
    expect(options.staleTime).toBe(300_000)
    expect(options.refetchOnWindowFocus).toBe(false)
  })

  it("matches the contract's page sizes, which the lists' 25, 50 and 100 rely on (research R5)", () => {
    const schemas = (
      contract as unknown as {
        components: {
          schemas: Record<string, { properties: Record<string, { examples?: number[] }> }>
        }
      }
    ).components.schemas
    const properties = schemas.AliasCapabilities!.properties
    expect(properties.defaultPageSize!.examples).toEqual([25])
    expect(properties.maxPageSize!.examples).toEqual([1000])
    expect(100).toBeLessThanOrEqual(properties.maxPageSize!.examples![0]!)
  })
})

const Child = defineComponent({
  props: { capabilities: { type: Object, required: true } },
  setup: (props) => () =>
    h('p', { class: 'child' }, String((props.capabilities as AliasCapabilities).bulkLimit)),
})

describe('CapabilitiesGate', () => {
  it('shows a skeleton while loading, then its slot with the capabilities', async () => {
    resetTestPlugins()
    server.use(http.get('*/api/v2/capabilities/aliases', () => HttpResponse.json({ data: CAPS })))
    const wrapper = mountWithApp(CapabilitiesGate, {
      slots: {
        default: ({ capabilities }: { capabilities: typeof CAPS }) => h(Child, { capabilities }),
      },
    })
    expect(wrapper.find('[data-capabilities-loading]').exists()).toBe(true)
    await flushPromises()
    expect(wrapper.get('.child').text()).toBe('100')
  })

  it('shows an error with a retry instead of assumed values', async () => {
    resetTestPlugins()
    let fail = true
    server.use(
      http.get('*/api/v2/capabilities/aliases', () =>
        fail
          ? HttpResponse.json(
              { type: 'about:blank', title: 'Error', status: 500 },
              { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
            )
          : HttpResponse.json({ data: CAPS }),
      ),
    )
    const wrapper = mountWithApp(CapabilitiesGate, {
      slots: { default: () => h('p', { class: 'child' }, 'ok') },
    })
    await flushPromises()
    expect(wrapper.find('.child').exists()).toBe(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    fail = false
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('.child').exists()).toBe(true)
  })
})
