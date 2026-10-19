// Exporting a private key (T091, research R12, FR-077): asked first, read with a direct call that
// no cache keeps, shown once with copy and download under `<selector>.<name>.pem`, gone after
// closing; a server with export turned off refreshes the capabilities.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { queryKeys } from '@/api'
import ExportPrivateKeyAction from '@/features/dns/components/ExportPrivateKeyAction.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'

import { useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'
import { dkimEntry } from './fixtures'

afterEach(() => settleConfirm(false))

const dialogText = () => document.querySelector('[role="dialog"]')?.textContent ?? ''

describe('ExportPrivateKeyAction', () => {
  it('asks, exports with a direct call and shows the key once', async () => {
    useScenario('dns-admin-fork')
    const wrapper = mountWithApp(ExportPrivateKeyAction, {
      props: { entry: dkimEntry() },
      attachTo: document.body,
    })
    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => expect(confirmState.value?.title).toBe('Private key'))
    expect(confirmState.value?.description).toContain('sign mail for example.org')
    settleConfirm(true)
    await vi.waitFor(() => expect(dialogText()).toContain('Private key'))
    const field = document.querySelector<HTMLTextAreaElement>('[role="dialog"] textarea')!
    expect(field.value).toContain('PRIVATE KEY')
    const { queryClient } = testPlugins()
    const cached = JSON.stringify([
      queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.state.data),
      queryClient
        .getMutationCache()
        .getAll()
        .map((mutation) => mutation.state.variables),
    ])
    expect(cached).not.toContain('PRIVATE KEY')
    wrapper.unmount()
  })

  it('refreshes the capabilities when export is turned off', async () => {
    const state = useScenario('dns-admin-fork')
    state.dns.capabilities.dkim.privateKeyExportEnabled = false
    const { queryClient } = testPlugins()
    queryClient.setQueryData(queryKeys.dns.capabilities(), { dkim: {} })
    const wrapper = mountWithApp(ExportPrivateKeyAction, {
      props: { entry: dkimEntry() },
      attachTo: document.body,
    })
    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => expect(confirmState.value).not.toBeNull())
    settleConfirm(true)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Private key export is turned off'))
    await flushPromises()
    expect(queryClient.getQueryState(queryKeys.dns.capabilities())?.isInvalidated).toBe(true)
    wrapper.unmount()
  })
})
