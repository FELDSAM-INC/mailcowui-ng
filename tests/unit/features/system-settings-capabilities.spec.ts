// UI 013 FR-001/FR-032: the settings boundary uses generated API data and preserves retry.
import { describe, expect, it, vi } from 'vitest'

import { ApiProblem, api, queryKeys, requireData } from '@/api'
import {
  settingsCapabilitiesOptions,
  useSettingsCapabilities,
} from '@/features/system-settings/api/capabilities'

import { mockState, useScenario } from '../../mocks/node'
import { withSetup } from '../support/composable'
import { testPlugins } from '../support/mount'

describe('settings capabilities boundary', () => {
  it('shares one five-minute read between consumers', async () => {
    useScenario('settings-admin-defaults')
    const options = settingsCapabilitiesOptions()
    expect(options.queryKey).toEqual(queryKeys.systemSettings.capabilities())
    expect(options.staleTime).toBe(300_000)
    const first = withSetup(() => useSettingsCapabilities())
    await vi.waitFor(() => expect(first.result.data.value?.hostname).toBe('mail.example.org'))
    const second = withSetup(() => useSettingsCapabilities())
    await vi.waitFor(() => expect(second.result.data.value).toEqual(first.result.data.value))
    expect(
      mockState().requests.filter((r) => r.operationId === 'getSettingsCapabilities'),
    ).toHaveLength(1)
    expect(testPlugins().queryClient.getQueryData(queryKeys.systemSettings.capabilities())).toEqual(
      first.result.data.value,
    )
  })

  it('retries a failed read and exposes the actual server limits', async () => {
    useScenario('settings-capabilities-error')
    const { result } = withSetup(() => useSettingsCapabilities())
    await vi.waitFor(() => expect(result.isError.value).toBe(true))
    delete mockState().failures.getSettingsCapabilities
    mockState().settings.capabilities.logos.maxBytes = 1024
    await result.refetch()
    expect(result.data.value?.logos.maxBytes).toBe(1024)
  })

  it.each(['settings-domain-admin', 'settings-mailbox-user'])(
    'refuses %s at the API too',
    async (scenario) => {
      useScenario(scenario)
      await expect(api.GET('/capabilities/settings').then(requireData)).rejects.toMatchObject({
        status: 403,
      })
    },
  )

  it('exposes demo mode and disabled license verification without inventing defaults', async () => {
    useScenario('settings-demo-mode', {
      settings: { capabilities: { licenseVerificationEnabled: false } },
    })
    const { result } = withSetup(() => useSettingsCapabilities())
    await vi.waitFor(() => expect(result.data.value).toBeDefined())
    expect(result.data.value?.demoMode).toBe(true)
    expect(result.data.value?.licenseVerificationEnabled).toBe(false)
    expect(result.error.value).not.toBeInstanceOf(ApiProblem)
  })
})
