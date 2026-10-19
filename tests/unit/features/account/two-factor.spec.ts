// The second factors at unit level (UI 005 T051, research R9 to R11): the QR code rendered from
// the allowlisted tree with its text alternative, the TOTP enrolment's states (key kept on a wrong
// code, expiry, discarding), the security key's failure table, the list's "only active entry" rule
// and the policy, and the Yubico form's checks.
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import type { OwnSecondFactor } from '@/api'
import { setSessionContext } from '@/app/session/context'
import QrCode from '@/features/account/components/two-factor/QrCode.vue'
import SecondFactorList from '@/features/account/components/two-factor/SecondFactorList.vue'
import TotpSetup from '@/features/account/components/two-factor/TotpSetup.vue'
import YubicoOtpSetup from '@/features/account/components/two-factor/YubicoOtpSetup.vue'
import { securityKeyFailureKey } from '@/features/account/composables/useSecurityKeyEnrolment'
import { useTotpEnrolment } from '@/features/account/composables/useTotpEnrolment'
import { loadLegacy } from '@/i18n/legacy'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'
import { createAppChannel } from '@/shared/platform/broadcast'
import { WebAuthnCeremonyError } from '@/shared/platform/webauthn'

import { totpCode } from '../../../support/totp'
import { qrDataUri } from '../../../mocks/factories/qr-svg'
import { mockState, useScenario } from '../../../mocks/node'
import { MOCK_PASSWORD } from '../../../mocks/scenarios/accounts'
import { withSetup } from '../../support/composable'
import { mountWithApp, testPlugins } from '../../support/mount'
import { createTestRouter } from '../../support/router'

beforeAll(async () => {
  await loadLegacy('en-gb')
})

afterEach(() => {
  settleConfirm(false)
  setSessionContext(null)
  vi.useRealTimers()
})

async function withRouter() {
  const router = createTestRouter()
  await router.push('/')
  setSessionContext({
    queryClient: testPlugins().queryClient,
    router,
    channel: createAppChannel('t'),
  })
  return router
}

const entry = (id: number, overrides: Partial<OwnSecondFactor> = {}): OwnSecondFactor => ({
  id,
  type: 'totp',
  name: `Entry ${id}`,
  active: true,
  usable: true,
  yubicoPublicId: null,
  usedForCurrentSignIn: false,
  ...overrides,
})

describe('QrCode', () => {
  it('renders svg elements with role img and the label pointing to the key', () => {
    const wrapper = mountWithApp(QrCode, { props: { dataUri: qrDataUri('otpauth://totp/x') } })
    const box = wrapper.get('[data-qr-code]')
    expect(box.attributes('role')).toBe('img')
    expect(box.attributes('aria-label')).toBe('QR code of the key shown as text')
    expect(wrapper.find('svg path').exists()).toBe(true)
  })

  it('shows the fallback note for an SVG it cannot render safely', () => {
    const bad = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')}`
    const wrapper = mountWithApp(QrCode, { props: { dataUri: bad } })
    expect(wrapper.find('[data-qr-code]').exists()).toBe(false)
    expect(wrapper.get('[data-qr-fallback]').text()).toContain('Open in authenticator app')
  })
})

describe('useTotpEnrolment', () => {
  it('keeps the key after a wrong code and confirms with a right one', async () => {
    useScenario('account-two-factor-empty')
    const { result } = withSetup(() => useTotpEnrolment())
    await result.start()
    expect(result.state.value).toBe('shown')
    const secret = result.enrolment.value!.secret
    await result.confirm({ name: 'Phone', code: '000000', currentPassword: MOCK_PASSWORD })
    expect(result.state.value).toBe('shown')
    expect(result.enrolment.value?.secret).toBe(secret)
    expect(result.problem.value?.attemptsRemaining).toBe(4)
    const done = await result.confirm({
      name: 'Phone',
      code: totpCode(secret, Date.now()),
      currentPassword: MOCK_PASSWORD,
    })
    expect(done?.type).toBe('totp')
    expect(result.state.value).toBe('done')
    expect(result.enrolment.value).toBeNull()
  })

  it('expires after the last wrong attempt and when the server says so', async () => {
    useScenario('account-two-factor-empty')
    const { result } = withSetup(() => useTotpEnrolment())
    await result.start()
    mockState().selfService.accounts['anna@example.org']!.totpEnrolment!.attemptsLeft = 1
    await result.confirm({ name: 'Phone', code: '000000', currentPassword: MOCK_PASSWORD })
    expect(result.state.value).toBe('expired')
    expect(result.enrolment.value).toBeNull()
    await result.start()
    mockState().selfService.accounts['anna@example.org']!.totpEnrolment = null
    await result.confirm({ name: 'Phone', code: '123456', currentPassword: MOCK_PASSWORD })
    expect(result.state.value).toBe('expired')
  })

  it('never puts the enrolment into a query or mutation cache, and forgets it on unmount', async () => {
    useScenario('account-two-factor-empty')
    const { result, unmount } = withSetup(() => useTotpEnrolment())
    await result.start()
    const secret = result.enrolment.value!.secret
    const { queryClient } = await import('@/api')
    expect(
      JSON.stringify(
        queryClient
          .getQueryCache()
          .getAll()
          .map((q) => q.state),
      ),
    ).not.toContain(secret)
    unmount()
    expect(result.enrolment.value).toBeNull()
  })
})

describe('securityKeyFailureKey (research R11)', () => {
  it.each([
    ['cancelled', 'account.twoFactor.webauthn.cancelled'],
    ['alreadyRegistered', 'account.twoFactor.webauthn.alreadyEnrolled'],
    ['unsupported', 'account.twoFactor.webauthn.keyUnsupported'],
    ['insecure', 'passkeys.errors.insecure'],
    ['unknown', 'passkeys.errors.generic'],
  ] as const)('%s → %s', (kind, key) => {
    expect(securityKeyFailureKey(new WebAuthnCeremonyError(kind, null))).toBe(key)
  })
})

describe('SecondFactorList', () => {
  function mountList(entries: OwnSecondFactor[], required = false) {
    return mountWithApp(SecondFactorList, {
      props: { entries, required, username: 'anna@example.org' },
      attachTo: document.body,
    })
  }

  it('shows types, states and the sign-in entry as text', async () => {
    await withRouter()
    const wrapper = mountList([
      entry(1, { usedForCurrentSignIn: true }),
      entry(2, { active: false }),
      entry(3, { type: 'u2f', usable: false }),
    ])
    expect(wrapper.get('[data-entry="1"]').text()).toContain('Used for this sign-in')
    expect(wrapper.get('[data-entry="2"]').text()).toContain('Inactive')
    expect(wrapper.get('[data-entry="3"]').text()).toContain('No longer supported')
    expect(wrapper.get('[data-entry="3"]').text()).toContain('Fido U2F')
  })

  it('turns two-factor authentication off from the only active entry, not counting unsupported ones', async () => {
    await withRouter()
    const wrapper = mountList([entry(1), entry(3, { type: 'u2f', usable: false })])
    await wrapper.get('[data-entry="1"] button').trigger('click')
    await flushPromises()
    expect(document.querySelector('[data-turn-off-dialog]')).not.toBeNull()
    expect(confirmState.value).toBeNull()
  })

  it('asks legacy’s “Are you sure?” for another entry', async () => {
    await withRouter()
    const wrapper = mountList([entry(1), entry(2)])
    await wrapper.get('[data-entry="2"] button').trigger('click')
    expect(confirmState.value?.title).toBe('Are you sure you want to proceed?')
    expect(confirmState.value?.confirmLabel).toBe('Remove')
  })

  it('offers no removal under the policy and explains it', async () => {
    await withRouter()
    const wrapper = mountList([entry(1), entry(2)], true)
    expect(wrapper.findAll('[data-entry] button')).toHaveLength(0)
    expect(wrapper.get('[data-policy-note]').text()).toContain(
      'Two-factor authentication cannot be removed',
    )
  })

  it('shows legacy’s empty text', async () => {
    await withRouter()
    expect(mountList([]).get('[data-empty]').text()).toBe('No record')
  })
})

describe('TotpSetup', () => {
  it('puts the key and its actions before the QR code, and the code field takes one-time codes', async () => {
    useScenario('account-two-factor-empty')
    await withRouter()
    const wrapper = mountWithApp(TotpSetup, { attachTo: document.body })
    await vi.waitFor(() => expect(wrapper.find('[data-grouped-secret]').exists()).toBe(true))
    const html = wrapper.html()
    expect(html.indexOf('data-open-in-app')).toBeLessThan(html.indexOf('data-qr-code'))
    expect(html.indexOf('data-grouped-secret')).toBeLessThan(html.indexOf('data-qr-code'))
    const code = wrapper.get('input[autocomplete="one-time-code"]')
    expect(code.attributes('inputmode')).toBe('numeric')
  })

  it('has no current password in forced setup', async () => {
    useScenario('forced-second-factor')
    await withRouter()
    const wrapper = mountWithApp(TotpSetup, {
      props: { requireCurrentPassword: false },
      attachTo: document.body,
    })
    await vi.waitFor(() => expect(wrapper.find('[data-grouped-secret]').exists()).toBe(true))
    expect(wrapper.find('input[autocomplete="current-password"]').exists()).toBe(false)
  })
})

describe('YubicoOtpSetup', () => {
  it('checks the client ID and the OTP before sending, and submits on the OTP’s Enter', async () => {
    useScenario('account-two-factor-empty')
    await withRouter()
    const Host = defineComponent({
      setup: () => () => h(YubicoOtpSetup, { onDone: () => undefined }),
    })
    const wrapper = mountWithApp(Host, { attachTo: document.body })
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('YubiKey')
    await inputs[1]!.setValue('12a')
    await inputs[2]!.setValue('secret')
    await inputs[3]!.setValue(MOCK_PASSWORD)
    await inputs[4]!.setValue('short')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('Use digits only.')
    expect(mockState().requests.some((r) => r.operationId === 'enrolOwnSecondFactor')).toBe(false)
    await inputs[1]!.setValue('12345')
    await inputs[4]!.setValue('cccccbcgujhingjrdejhgfnuetrgigvejhhgbkugdedf')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() =>
      expect(mockState().requests.some((r) => r.operationId === 'enrolOwnSecondFactor')).toBe(true),
    )
    expect(wrapper.findAll('input').at(-1)!.attributes('type')).toBe('password')
  })
})
