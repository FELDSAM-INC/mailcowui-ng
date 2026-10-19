// T112: the pending-actions screen (FR-038–FR-041): the order of actions, the classic sign-in per
// role, "Check again" (session and identity read again) and registration gated by a sole
// second-factor setup.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { installGuards } from '@/app/router/guards'
import { setSessionContext } from '@/app/session/context'
import PendingActionsPage from '@/features/auth/pages/PendingActionsPage.vue'
import { createAppChannel } from '@/shared/platform/broadcast'

import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'
import { createTestRouter } from '../../support/router'
import { installWebAuthn } from '../../support/webauthn-stub'

afterEach(() => setSessionContext(null))

async function mountPage() {
  const router = createTestRouter()
  const queryClient = testPlugins().queryClient
  installGuards(router, { queryClient })
  setSessionContext({ queryClient, router, channel: createAppChannel('test') })
  await router.push('/pending-actions')
  const wrapper = mountWithApp(PendingActionsPage, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await vi.waitFor(() => expect(wrapper.findAll('li').length).toBeGreaterThan(0))
  await flushPromises()
  return { wrapper, router }
}

const headings = (wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper']) =>
  wrapper.findAll('li h2').map((h) => h.text())

describe('PendingActionsPage', () => {
  it('lists the password change first, the second-factor setup as the next step', async () => {
    useScenario('forced-both')
    installWebAuthn()
    const { wrapper } = await mountPage()
    // The classic forced-change modals' titles (`user.change_password`, `tfa.setup_title`).
    expect(headings(wrapper)).toEqual(['Change password', 'Two-Factor Authentication Required'])
    expect(wrapper.text()).toContain(
      'You set up a second factor here once your new password is saved.',
    )
    expect(wrapper.findAll('button').some((b) => b.text() === 'Register a passkey')).toBe(false)
  })

  it('UI 005 (FR-029): sets the password here, without a classic link or "Check again"', async () => {
    useScenario('account-forced-password-policy')
    const { wrapper, router } = await mountPage()
    expect(wrapper.find('[data-forced-password]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Check again')
    expect(wrapper.find('li a[href="/"]').exists()).toBe(false)
    expect(wrapper.find('input[autocomplete="current-password"]').exists()).toBe(false)
    const inputs = wrapper.findAll('input[autocomplete="new-password"]')
    await inputs[0]!.setValue('summer2026x')
    await inputs[1]!.setValue('summer2026x')
    const before = mockState().requests.length
    await wrapper.get('[data-forced-password]').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/'))
    const ops = mockState()
      .requests.slice(before)
      .map((r) => r.operationId)
    expect(ops).toEqual(expect.arrayContaining(['changeOwnPassword', 'getSession', 'getIdentity']))
    const change = mockState().requests.find((r) => r.operationId === 'changeOwnPassword')!
    expect(change.body).toEqual({ newPassword: '[redacted]', endOtherSessions: true })
  })

  it('UI 005 (FR-030): shows a refused password on its field and marks the rules', async () => {
    useScenario('account-forced-password-policy')
    const { wrapper } = await mountPage()
    const inputs = wrapper.findAll('input[autocomplete="new-password"]')
    await inputs[0]!.setValue('summer')
    await inputs[1]!.setValue('summer')
    await wrapper.get('[data-forced-password]').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Password does not meet the policy'))
    expect(wrapper.find('[data-rule="digits"][data-met="false"]').exists()).toBe(true)
  })

  it('UI 005 (FR-031): continues with the second-factor setup after the password', async () => {
    useScenario('account-forced-both-policy')
    installWebAuthn()
    const { wrapper } = await mountPage()
    const inputs = wrapper.findAll('input[autocomplete="new-password"]')
    await inputs[0]!.setValue('summer2026x')
    await inputs[1]!.setValue('summer2026x')
    await wrapper.get('[data-forced-password]').trigger('submit')
    await vi.waitFor(() =>
      expect(headings(wrapper)).toEqual(['Two-Factor Authentication Required']),
    )
  })

  it('offers the passkey first, then TOTP, WebAuthn and Yubico OTP (FR-058)', async () => {
    useScenario('forced-second-factor')
    installWebAuthn()
    const { wrapper } = await mountPage()
    const buttons = wrapper.findAll('[data-forced-second-factor] button').map((b) => b.text())
    expect(buttons).toEqual([
      'Register a passkey',
      'Time-based OTP (Google Authenticator, Authy, etc.)',
      'WebAuthn authentication',
      'Yubico OTP authentication',
    ])
  })

  it('offers the other methods in place of the classic link without passkeys (FR-057)', async () => {
    useScenario('forced-second-factor')
    installWebAuthn({ supported: false })
    const { wrapper } = await mountPage()
    expect(wrapper.text()).not.toContain('Register a passkey')
    expect(wrapper.find('li a[href="/"]').exists()).toBe(false)
    expect(wrapper.find('[data-method="yubiOtp"]').exists()).toBe(true)
  })

  it('lifts the restriction with a Yubico OTP key, without the current password', async () => {
    useScenario('forced-second-factor')
    installWebAuthn({ supported: false })
    const { wrapper, router } = await mountPage()
    await wrapper.get('[data-method="yubiOtp"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-yubico-setup]').exists()).toBe(true))
    expect(wrapper.find('input[autocomplete="current-password"]').exists()).toBe(false)
    const inputs = wrapper.findAll('[data-yubico-setup] input')
    await inputs[0]!.setValue('YubiKey')
    await inputs[1]!.setValue('12345')
    await inputs[2]!.setValue('secret')
    await inputs[3]!.setValue('cccccbcgujhingjrdejhgfnuetrgigvejhhgbkugdedf')
    await wrapper.get('[data-yubico-setup]').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/'))
  })
})
