// The routing capabilities (UI 009 T008, research R3): one read kept for five minutes, the
// administrator and domain administrator shapes, the page sizes the server allows, and an error
// that offers a retry.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import {
  CAPABILITIES_STALE_TIME,
  pageSizeOptions,
  routingCapabilitiesOptions,
  useRoutingCapabilities,
} from '@/features/routing/capabilities'

import { mockState, useScenario } from '../../../mocks/node'
import { defaultRoutingCapabilities } from '../../../mocks/scenarios/routing/state'
import { withSetup } from '../../support/composable'

describe('routing capabilities', () => {
  it('reads once with the query key and a five-minute freshness', () => {
    const options = routingCapabilitiesOptions()
    expect(options.queryKey).toEqual(['routing-capabilities'])
    expect(options.staleTime).toBe(CAPABILITIES_STALE_TIME)
    expect(CAPABILITIES_STALE_TIME).toBe(300_000)
  })

  it('offers 25, 50 and 100 up to the server maximum', () => {
    const capabilities = defaultRoutingCapabilities()
    expect(pageSizeOptions(capabilities)).toEqual([25, 50, 100])
    expect(pageSizeOptions({ ...capabilities, pageSize: { default: 25, maximum: 50 } })).toEqual([
      25, 50,
    ])
    expect(pageSizeOptions(undefined)).toEqual([25, 50, 100])
  })

  it('gives administrators the administration values', async () => {
    useScenario('routing-admin-default')
    const { result } = withSetup(() => useRoutingCapabilities())
    await flushPromises()
    await vi.waitFor(() => expect(result.data.value).toBeDefined())
    expect(result.bulkLimit.value).toBe(100)
    expect(result.administration.value?.connectionTest.defaultRecipient).toBe(
      'null@hosted.mailcow.de',
    )
  })

  it('gives domain administrators no administration values', async () => {
    useScenario('routing-da-bcc')
    const { result } = withSetup(() => useRoutingCapabilities())
    await vi.waitFor(() => expect(result.data.value).toBeDefined())
    expect(result.administration.value).toBeNull()
  })

  it('exposes an error with a retry', async () => {
    useScenario('routing-admin-default')
    mockState().failures.getRoutingCapabilities = { status: 500 }
    const { result } = withSetup(() => useRoutingCapabilities())
    await vi.waitFor(() => expect(result.isError.value).toBe(true))
    delete mockState().failures.getRoutingCapabilities
    await result.refetch()
    expect(result.data.value?.bulkLimit).toBe(100)
  })
})
