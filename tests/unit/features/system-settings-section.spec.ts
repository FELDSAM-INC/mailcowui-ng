import { describe, expect, it } from 'vitest'
import { shallowRef } from 'vue'

import { queryKeys, type IpCheckSetting } from '@/api'
import { fetchIpCheck, updateIpCheck } from '@/features/system-settings/api/server'
import { useSettingsSection } from '@/features/system-settings/composables/useSettingsSection'

import { mockState, useScenario } from '../../mocks/node'
import { withSetup } from '../support/composable'
import { testPlugins } from '../support/mount'

async function setup() {
  const state = useScenario('settings-admin-defaults')
  const current = shallowRef<IpCheckSetting>(await fetchIpCheck())
  testPlugins().queryClient.setQueryData(queryKeys.systemSettings.ipCheck(), current.value)
  const { result } = withSetup(() =>
    useSettingsSection({
      resource: () => current.value,
      key: queryKeys.systemSettings.ipCheck(),
      fields: ['enabled'],
      refetch: async () => {
        current.value = await fetchIpCheck()
        return current.value
      },
      toDraft: (resource) => ({ enabled: resource.enabled }),
      toPatch: (draft, base) =>
        draft.enabled === base.enabled ? null : { enabled: draft.enabled },
      send: updateIpCheck,
      success: () => 'Saved',
    }),
  )
  result.open()
  return { state, result, current }
}

describe('versioned settings section', () => {
  it('sends only changed fields with the read version and caches the response', async () => {
    const { result, current } = await setup()
    const before = current.value.etag
    result.draft.value!.enabled = true
    expect(result.dirty.value).toBe(true)
    await result.save()
    const request = mockState().requests.find((r) => r.operationId === 'updateIpCheckSetting')!
    expect(request.body).toEqual({ enabled: true })
    expect(request.headers['if-match']).toBe(before)
    expect(request.headers['content-type']).toContain('application/merge-patch+json')
    expect(
      testPlugins().queryClient.getQueryData(queryKeys.systemSettings.ipCheck()),
    ).toMatchObject({ enabled: true })
    expect(result.editing.value).toBe(false)
    expect(result.dirty.value).toBe(false)
  })

  it('does not send an unchanged section', async () => {
    const { result } = await setup()
    await result.save()
    expect(mockState().requests.some((r) => r.operationId === 'updateIpCheckSetting')).toBe(false)
  })

  it('keeps a draft after 412 and requires an explicit retry against the new version', async () => {
    const { result, state } = await setup()
    result.draft.value!.enabled = true
    state.settings.ipCheck.etag = '"ip-check-2"'
    await result.save()
    expect(result.outdated.value).toBe(true)
    expect(result.draft.value?.enabled).toBe(true)
    expect(state.settings.ipCheck.enabled).toBe(false)
    await result.saveAgain()
    expect(state.settings.ipCheck.enabled).toBe(true)
    expect(state.settings.ipCheck.etag).not.toBe('"ip-check-2"')
    const requests = state.requests.filter((r) => r.operationId === 'updateIpCheckSetting')
    expect(requests).toHaveLength(2)
    expect(requests[1]!.headers['if-match']).toBe('"ip-check-2"')
  })

  it('discards a stale draft using the latest stored value', async () => {
    const { result, state } = await setup()
    result.draft.value!.enabled = true
    state.settings.ipCheck.etag = '"ip-check-2"'
    await result.save()
    result.discard()
    expect(result.editing.value).toBe(false)
    expect(result.draft.value?.enabled).toBe(false)
    expect(result.dirty.value).toBe(false)
  })

  it('keeps input and invalidates capabilities after a new demo-mode refusal', async () => {
    const { result, state } = await setup()
    testPlugins().queryClient.setQueryData(
      queryKeys.systemSettings.capabilities(),
      state.settings.capabilities,
    )
    state.settings.capabilities.demoMode = true
    result.draft.value!.enabled = true
    await result.save()
    expect(result.problem.value?.is('demo-mode')).toBe(true)
    expect(result.draft.value?.enabled).toBe(true)
    expect(result.editing.value).toBe(true)
    expect(
      testPlugins().queryClient.getQueryState(queryKeys.systemSettings.capabilities())
        ?.isInvalidated,
    ).toBe(true)
  })

  it('keeps input after service failure and prevents duplicate pending saves', async () => {
    const { result, state } = await setup()
    result.draft.value!.enabled = true
    state.failures.updateIpCheckSetting = { status: 503, type: 'temporary-failure', times: 1 }
    await Promise.all([result.save(), result.save()])
    expect(result.problem.value?.status).toBe(503)
    expect(result.draft.value?.enabled).toBe(true)
    expect(state.requests.filter((r) => r.operationId === 'updateIpCheckSetting')).toHaveLength(1)
    await result.save()
    expect(state.settings.ipCheck.enabled).toBe(true)
  })
})
