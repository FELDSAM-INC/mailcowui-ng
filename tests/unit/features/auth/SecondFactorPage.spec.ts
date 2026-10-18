// T073: the second-factor step page (FR-020–FR-027).
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { installGuards } from '@/app/router/guards'
import { setSessionContext } from '@/app/session/context'
import { useSessionStore } from '@/app/session/store'
import SecondFactorPage from '@/features/auth/pages/SecondFactorPage.vue'
import { liveMessages } from '@/shared/composables/useAnnouncer'
import { createAppChannel } from '@/shared/platform/broadcast'

import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'
import { createTestRouter } from '../../support/router'
import { installWebAuthn } from '../../support/webauthn-stub'

afterEach(() => {
  setSessionContext(null)
  vi.useRealTimers()
})

function pendingScenario(name: string, expiresInMs = 300_000) {
  useScenario(name, {
    session: {
      state: 'pendingSecondFactor',
      username: 'alice@example.org',
      pendingSignIn: {
        username: 'alice@example.org',
        role: null,
        expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
      },
    },
  })
}

async function mountStep() {
  const router = createTestRouter()
  const queryClient = testPlugins().queryClient
  installGuards(router, { queryClient })
  setSessionContext({ queryClient, router, channel: createAppChannel('test') })
  await router.push('/sign-in/second-factor')
  const wrapper = mountWithApp(SecondFactorPage, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await vi.waitFor(() => expect(wrapper.find('h1').exists()).toBe(true))
  await flushPromises()
  return { wrapper, router }
}

const headings = (wrapper: Awaited<ReturnType<typeof mountStep>>['wrapper']) =>
  wrapper.findAll('h2').map((h) => h.text())

describe('methods (FR-020, FR-022)', () => {
  it('lists the primary methods and keeps Yubico OTP behind "Other methods"', async () => {
    pendingScenario('mailbox-all-factors')
    const { wrapper } = await mountStep()
    expect(wrapper.get('h1').text()).toBe('Two-factor authentication')
    // The classic names of the methods (`tfa.webauthn`, `tfa.totp`, `tfa.yubi_otp`).
    expect(headings(wrapper)).toEqual([
      'WebAuthn authentication',
      'Time-based OTP (Google Authenticator, Authy, etc.)',
    ])
    const trigger = wrapper.get('button[aria-expanded]')
    expect(trigger.text()).toContain('Other methods')
    await trigger.trigger('click')
    await flushPromises()
    expect(headings(wrapper)).toContain('Yubico OTP authentication')
  })

  it('shows Yubico OTP directly when it is the only method', async () => {
    pendingScenario('yubi-only')
    const { wrapper } = await mountStep()
    expect(headings(wrapper)).toEqual(['Yubico OTP authentication'])
    expect(wrapper.find('button[aria-expanded]').exists()).toBe(false)
  })

  it('preselects a single authenticator and focuses the code field', async () => {
    pendingScenario('anonymous-default')
    const { wrapper } = await mountStep()
    expect(wrapper.find('fieldset').exists()).toBe(false)
    const code = wrapper.get('input[autocomplete="one-time-code"]')
    expect(code.attributes('inputmode')).toBe('numeric')
    expect(document.activeElement).toBe(code.element)
  })

  it('lets the user choose between two authenticators by name', async () => {
    pendingScenario('totp-two-methods')
    const { wrapper, router } = await mountStep()
    const radios = wrapper.findAll<HTMLInputElement>('fieldset input[type="radio"]')
    expect(radios.map((r) => r.element.labels?.[0]?.textContent?.trim())).toEqual([
      'Phone',
      'Tablet',
    ])
    expect(radios[0]?.element.checked).toBe(true)
    await radios[1]!.setValue(true)
    await wrapper.get('input[autocomplete="one-time-code"]').setValue('654321')
    await wrapper.get('[data-method="totp"] form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/'))
    const verify = mockState().requests.find((r) => r.operationId === 'verifySecondFactor')
    expect(verify?.body).toMatchObject({ type: 'totp', methodId: 22 })
  })
})

describe('validation and outcomes (FR-022–FR-027)', () => {
  it('checks the code format before sending', async () => {
    pendingScenario('anonymous-default')
    const { wrapper } = await mountStep()
    await wrapper.get('input[autocomplete="one-time-code"]').setValue('12345')
    await wrapper.get('[data-method="totp"] form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Enter the six-digit code.')
    expect(mockState().requests.some((r) => r.operationId === 'verifySecondFactor')).toBe(false)
  })

  it('returns to the password step with the username kept after a wrong code', async () => {
    pendingScenario('anonymous-default')
    const { wrapper, router } = await mountStep()
    await wrapper.get('input[autocomplete="one-time-code"]').setValue('000000')
    await wrapper.get('[data-method="totp"] form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('sign-in'))
    const store = useSessionStore()
    expect(store.keptUsername).toBe('alice@example.org')
    expect(store.notice).toBe('secondFactorRejected')
  })

  it('stays in the step during a Yubico outage', async () => {
    pendingScenario('yubico-outage')
    const { wrapper, router } = await mountStep()
    await wrapper.get('button[aria-expanded]').trigger('click')
    await flushPromises()
    await wrapper
      .get('[data-method="yubiOtp"] input')
      .setValue('cccccbcgujhingjrdejhgfnuetrgigvejhhgbkugdedf')
    await wrapper.get('[data-method="yubiOtp"] form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Temporary error'))
    expect(router.currentRoute.value.name).toBe('sign-in-second-factor')
  })

  it('verifies with WebAuthn, and a cancelled prompt sends nothing', async () => {
    pendingScenario('mailbox-all-factors')
    const webauthn = installWebAuthn()
    webauthn.get.mockRejectedValueOnce(new DOMException('cancelled', 'NotAllowedError'))
    const { wrapper } = await mountStep()
    await wrapper.get('[data-method="webauthn"] button').trigger('click')
    await vi.waitFor(() => expect(webauthn.get).toHaveBeenCalledTimes(1))
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(mockState().requests.some((r) => r.operationId === 'verifySecondFactor')).toBe(false)
    expect(webauthn.get).toHaveBeenCalledTimes(1)
  })

  it('cancels the pending sign-in', async () => {
    pendingScenario('anonymous-default')
    const { wrapper, router } = await mountStep()
    const cancel = wrapper.findAll('button').find((b) => b.text() === 'Cancel')
    await cancel!.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('sign-in'))
    expect(mockState().requests.some((r) => r.operationId === 'cancelPendingSignIn')).toBe(true)
    expect(useSessionStore().notice).toBeNull()
  })
})

describe('the time limit (FR-025)', () => {
  it('warns when one minute remains and times out with the username kept', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    pendingScenario('anonymous-default', 62_000)
    const { wrapper, router } = await mountStep()
    expect(wrapper.text()).not.toContain('One minute left')
    await vi.advanceTimersByTimeAsync(3_000)
    expect(wrapper.text()).toContain('One minute left to complete the sign-in.')
    await vi.advanceTimersByTimeAsync(100)
    expect(liveMessages.assertive.value).toBe('One minute left to complete the sign-in.')
    await vi.advanceTimersByTimeAsync(60_000)
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('sign-in'))
    expect(useSessionStore().notice).toBe('signInTimedOut')
    expect(useSessionStore().keptUsername).toBe('alice@example.org')
  })
})
