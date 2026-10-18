// T104: the passkey suggestion of the home screen (FR-047): shown without passkeys on a capable
// device, dismissible on this device, never shown without support.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import PasskeySuggestion from '@/features/home/components/PasskeySuggestion.vue'

import { alicePasskeys } from '../../../mocks/scenarios/passkeys'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'
import { createTestRouter } from '../../support/router'
import { installWebAuthn } from '../../support/webauthn-stub'

async function mountSuggestion() {
  const router = createTestRouter()
  await router.push('/')
  const wrapper = mountWithApp(PasskeySuggestion, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('PasskeySuggestion', () => {
  it('suggests a passkey when the account has none', async () => {
    useScenario('admin-no-passkeys')
    installWebAuthn()
    const wrapper = await mountSuggestion()
    await vi.waitFor(() => expect(wrapper.find('section').exists()).toBe(true))
    expect(wrapper.get('a').attributes('href')).toBe('/ng/passkeys')
    const request = mockState().requests.find((r) => r.operationId === 'listPasskeys')
    expect(request?.path).toContain('limit=1')
  })

  it('stays hidden when the account has a passkey', async () => {
    useScenario('user-with-passkeys', {})
    mockState().accounts.find((a) => a.username === 'alice@example.org')!.passkeys = alicePasskeys()
    installWebAuthn()
    const wrapper = await mountSuggestion()
    await vi.waitFor(() =>
      expect(mockState().requests.some((r) => r.operationId === 'listPasskeys')).toBe(true),
    )
    await flushPromises()
    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('stays hidden and asks nothing without passkey support', async () => {
    useScenario('admin-no-passkeys')
    installWebAuthn({ supported: false })
    const wrapper = await mountSuggestion()
    expect(wrapper.find('section').exists()).toBe(false)
    expect(mockState().requests).toEqual([])
  })

  it('remembers a dismissal on this device', async () => {
    useScenario('admin-no-passkeys')
    installWebAuthn()
    const wrapper = await mountSuggestion()
    await vi.waitFor(() => expect(wrapper.find('section').exists()).toBe(true))
    await wrapper.get('button').trigger('click')
    expect(wrapper.find('section').exists()).toBe(false)
    expect(localStorage.getItem('mailcowui-ng.passkey-suggestion-dismissed')).toBe('1')
    const again = await mountSuggestion()
    expect(again.find('section').exists()).toBe(false)
  })
})
