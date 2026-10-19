// UI 011 (research R4, T017): the monitoring capabilities drive every interval and limit; nothing
// they report is hard-coded, and a failed read gives no fallback.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { MonitoringCapabilities } from '@/api'
import { intervalSeconds, useMonitoringCapabilities } from '@/features/operations/capabilities'

import { mockState, useScenario } from '../../../mocks/node'
import { defaultMonitoringCapabilities } from '../../../mocks/scenarios/operations/state'
import { withSetup } from '../../support/composable'

describe('intervalSeconds', () => {
  const capabilities = defaultMonitoringCapabilities()

  it('polls host figures, containers and resource usage at the recommended interval', () => {
    expect(intervalSeconds(capabilities, 'host')).toBe(5)
    expect(intervalSeconds(capabilities, 'containers')).toBe(5)
    expect(intervalSeconds(capabilities, 'resourceUsage')).toBe(5)
  })

  it('reads the mail storage at its freshness limit', () => {
    expect(intervalSeconds(capabilities, 'mailStorage')).toBe(60)
  })

  it('follows other capabilities', () => {
    const other: MonitoringCapabilities = {
      ...capabilities,
      pollIntervalSeconds: 60,
      maxAgeSeconds: { ...capabilities.maxAgeSeconds, mailStorage: 300 },
    }
    expect(intervalSeconds(other, 'host')).toBe(60)
    expect(intervalSeconds(other, 'mailStorage')).toBe(300)
  })
})

describe('useMonitoringCapabilities', () => {
  it('reads the capabilities once and passes the limits through', async () => {
    useScenario('admin-operations')
    const { result } = withSetup(() => useMonitoringCapabilities())
    await flushPromises()
    await vi_waitFor(() => result.capabilities.value !== null)
    expect(result.capabilities.value?.limits.mailQueueBulkMaxIds).toBe(1000)
    expect(result.intervalMs('host')).toBe(5000)
    expect(result.unavailable.value).toBe(false)
    expect(
      mockState().requests.filter((r) => r.operationId === 'getMonitoringCapabilities'),
    ).toHaveLength(1)
  })

  it('is unavailable without a fallback when the read fails', async () => {
    useScenario('admin-operations', {
      operations: { inject: { getMonitoringCapabilities: { status: 500 } } },
    })
    const { result } = withSetup(() => useMonitoringCapabilities())
    await vi_waitFor(() => result.unavailable.value)
    expect(result.capabilities.value).toBeNull()
    expect(result.intervalMs('host')).toBeNull()
  })
})

async function vi_waitFor(condition: () => boolean) {
  for (let i = 0; i < 100 && !condition(); i += 1) {
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  expect(condition()).toBe(true)
}
