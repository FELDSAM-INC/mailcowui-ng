import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { OwnSecondFactorWebAuthnOptions, WebAuthnRegistrationResponse } from '@/api'
import * as accountApi from '@/features/account/api/second-factors'
import { useSecurityKeyEnrolment } from '@/features/account/composables/useSecurityKeyEnrolment'
import { useTotpEnrolment } from '@/features/account/composables/useTotpEnrolment'
import * as webauthn from '@/shared/platform/webauthn'

import { creationOptions, fakeRegistration } from '../../../mocks/factories/webauthn'
import { withSetup } from '../../support/composable'

const options = (): OwnSecondFactorWebAuthnOptions => ({
  publicKey: creationOptions({ username: 'anna@example.org' }),
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
})

describe('second-factor enrolment scope disposal', () => {
  it('does not open an authenticator for options received after the setup was closed', async () => {
    let release!: (value: OwnSecondFactorWebAuthnOptions) => void
    const waiting = new Promise<OwnSecondFactorWebAuthnOptions>((resolve) => {
      release = resolve
    })
    vi.spyOn(accountApi, 'createSecondFactorWebAuthnOptions').mockReturnValue(waiting)
    const create = vi
      .spyOn(webauthn, 'createRegistration')
      .mockRejectedValue(new Error('A closed setup must not open the authenticator'))
    const { result, unmount } = withSetup(() => useSecurityKeyEnrolment())
    const running = result.start({ name: 'Security key', currentPassword: 'Secret-password-1' })
    unmount()
    release(options())
    expect(await running).toBeNull()
    expect(create).not.toHaveBeenCalled()
  })

  it('does not enrol a key when the authenticator finishes after the setup was closed', async () => {
    const issued = options()
    vi.spyOn(accountApi, 'createSecondFactorWebAuthnOptions').mockResolvedValue(issued)
    let release!: (value: WebAuthnRegistrationResponse) => void
    const waiting = new Promise<WebAuthnRegistrationResponse>((resolve) => {
      release = resolve
    })
    const create = vi.spyOn(webauthn, 'createRegistration').mockReturnValue(waiting)
    const enrol = vi.spyOn(accountApi, 'enrolSecondFactor').mockResolvedValue({
      id: 42,
      type: 'webauthn',
      name: 'Security key',
      active: true,
      usable: true,
      yubicoPublicId: null,
      usedForCurrentSignIn: false,
    })
    const { result, unmount } = withSetup(() => useSecurityKeyEnrolment())
    const running = result.start({ name: 'Security key', currentPassword: 'Secret-password-1' })
    await flushPromises()
    expect(create).toHaveBeenCalledTimes(1)
    const signal = create.mock.calls[0]?.[1]?.signal
    expect(signal).toBeInstanceOf(AbortSignal)
    unmount()
    expect(signal?.aborted).toBe(true)
    release(fakeRegistration('Y3JlZA', issued.publicKey.challenge))
    expect(await running).toBeNull()
    expect(enrol).not.toHaveBeenCalled()
  })

  it('does not restore a TOTP secret returned after its setup was closed', async () => {
    let release!: (value: Awaited<ReturnType<typeof accountApi.startTotpEnrolment>>) => void
    const waiting = new Promise<Awaited<ReturnType<typeof accountApi.startTotpEnrolment>>>(
      (resolve) => {
        release = resolve
      },
    )
    vi.spyOn(accountApi, 'startTotpEnrolment').mockReturnValue(waiting)
    const { result, unmount } = withSetup(() => useTotpEnrolment())
    const running = result.start()
    unmount()
    release({
      enrolment: {
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        issuer: 'Test',
        secret: 'JBSWY3DPEHPK3PXP',
        provisioningUri: 'otpauth://totp/Test?secret=JBSWY3DPEHPK3PXP',
        qrCode: 'data:image/svg+xml;base64,PHN2Zy8+',
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      },
      skew: 0,
    })
    await running
    expect(result.enrolment.value).toBeNull()
    expect(result.state.value).not.toBe('shown')
  })
})
