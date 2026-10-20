// Enrolling a security key (UI 005 data-model §7, research R11): an explicit start fetches the
// options (they exclude the account's WebAuthn factors), runs the device's ceremony and sends the
// credential with the name and, outside forced setup, the current password. The waits are
// announced ("touch your key", then "waiting for the server"); every failure is explained in plain
// words and offers "Try again", which fetches new options. Nothing is kept after the component.
import { onScopeDispose, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ApiProblem, OwnSecondFactor, WebAuthnCreationOptions } from '@/api'
import { lt } from '@/i18n'
import { announce } from '@/shared/composables/useAnnouncer'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { createRegistration, WebAuthnCeremonyError } from '@/shared/platform/webauthn'

import { createSecondFactorWebAuthnOptions, enrolSecondFactor } from '../api/second-factors'

export type SecurityKeyState =
  'idle' | 'requesting' | 'awaitingKey' | 'verifying' | 'done' | 'failed'

/** The message of a failed ceremony or enrolment (research R11's table). */
export function securityKeyFailureKey(error: unknown): string | null {
  if (error instanceof WebAuthnCeremonyError) {
    switch (error.kind) {
      case 'cancelled':
      case 'aborted':
        return 'account.twoFactor.webauthn.cancelled'
      case 'alreadyRegistered':
        return 'account.twoFactor.webauthn.alreadyEnrolled'
      case 'unsupported':
        return 'account.twoFactor.webauthn.keyUnsupported'
      case 'insecure':
        return 'passkeys.errors.insecure'
      default:
        return 'passkeys.errors.generic'
    }
  }
  return null
}

export function useSecurityKeyEnrolment() {
  const { t } = useI18n()
  const state = ref<SecurityKeyState>('idle')
  /** A plain-language failure (ceremony or verification), as text. */
  const message = ref<string | null>(null)
  const problem = shallowRef<ApiProblem | null>(null)
  const optionsRequest = useSecretRequest(createSecondFactorWebAuthnOptions)
  const enrolRequest = useSecretRequest(enrolSecondFactor)
  let disposed = false
  let ceremony: AbortController | null = null

  function fail(text: string | null, failure: ApiProblem | null = null) {
    state.value = 'failed'
    message.value = text
    problem.value = failure
    if (text) announce(text, { assertive: true })
  }

  async function start(input: {
    name: string
    currentPassword?: string
  }): Promise<OwnSecondFactor | null> {
    if (
      disposed ||
      state.value === 'requesting' ||
      state.value === 'awaitingKey' ||
      state.value === 'verifying'
    )
      return null
    message.value = null
    problem.value = null
    state.value = 'requesting'
    const options = await optionsRequest.run()
    if (disposed) return null
    if (!options) {
      fail(null, optionsRequest.problem.value)
      return null
    }
    state.value = 'awaitingKey'
    announce(t('account.twoFactor.webauthn.touchKey'))
    let credential
    const controller = new AbortController()
    ceremony = controller
    try {
      credential = await createRegistration(options.publicKey as WebAuthnCreationOptions, {
        signal: controller.signal,
      })
    } catch (error) {
      if (disposed) return null
      fail(t(securityKeyFailureKey(error) ?? 'passkeys.errors.generic'))
      return null
    } finally {
      if (ceremony === controller) ceremony = null
    }
    if (disposed || controller.signal.aborted) return null
    state.value = 'verifying'
    announce(t('account.twoFactor.webauthn.waitingServer'))
    const entry = await enrolRequest.run({
      type: 'webauthn',
      name: input.name,
      credential,
      ...(input.currentPassword !== undefined ? { currentPassword: input.currentPassword } : {}),
    })
    if (disposed) return null
    if (entry) {
      state.value = 'done'
      return entry
    }
    const failure = enrolRequest.problem.value
    if (failure?.is('second-factor-enrolment-failed')) {
      fail(lt('danger.webauthn_verification_failed', 'unknown'), failure)
    } else if (failure?.is('second-factor-enrolment-expired')) {
      fail(t('problem.second-factor-enrolment-expired'), failure)
    } else fail(null, failure)
    return null
  }

  function reset() {
    state.value = 'idle'
    message.value = null
    problem.value = null
  }

  onScopeDispose(() => {
    disposed = true
    ceremony?.abort()
    optionsRequest.clear()
    enrolRequest.clear()
    message.value = null
    problem.value = null
  })

  return { state, message, problem, start, reset }
}
