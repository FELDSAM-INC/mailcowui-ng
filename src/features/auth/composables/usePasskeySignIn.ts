// Passkey sign-in with one action (FR-010, FR-011, FR-013, FR-014, research R14): abort the
// conditional request, request a challenge, let the device verify the user, and submit the
// assertion with the role of the screen. A cancelled or aborted prompt is silent; a rejected
// passkey gives one generic message that suggests username and password; throttling disables the
// action like password sign-in (US2-AS6). Failures of the autofill request are reported here too.
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { ApiProblem, isApiProblem, type Role } from '@/api'
import { useProblemMessages } from '@/i18n/problems'
import { announce } from '@/shared/composables/useAnnouncer'
import { getAssertion, WebAuthnCeremonyError, webAuthnMessageKey } from '@/shared/platform/webauthn'

import { acceptSession, createPasskeyChallenge, createSessionWithPasskey } from '../api'
import { useThrottle } from './useThrottle'

export interface PasskeySignInOptions {
  role: () => Role | null
  /**
   * Called before the challenge is requested: the autofill request is aborted first, which
   * WebAuthn requires, and so that a challenge it is still fetching cannot abort this ceremony.
   */
  onStart?: () => void
  /** Called after every attempt that did not sign in (restarts the autofill request). */
  onSettled?: () => void
}

export function usePasskeySignIn(options: PasskeySignInOptions) {
  const { t } = useI18n()
  const { problemMessage } = useProblemMessages()
  const pending = ref(false)
  /** A problem shown with its translated message (throttling, a lost connection, …). */
  const problem = shallowRef<ApiProblem | null>(null)
  /** A passkey-specific message (`auth.passkey.*`, `passkeys.errors.*`). */
  const messageKey = ref<string | null>(null)
  const throttle = useThrottle()

  function clear() {
    problem.value = null
    messageKey.value = null
  }

  function showMessage(key: string) {
    messageKey.value = key
    announce(t(key), { assertive: true })
  }

  /** Shows what an attempt (modal or autofill) ended with. */
  function report(error: unknown): void {
    clear()
    if (error instanceof WebAuthnCeremonyError) {
      const key = webAuthnMessageKey(error.kind)
      if (key) showMessage(key)
      return
    }
    const failure = isApiProblem(error)
      ? error
      : ApiProblem.fromParts({ kind: 'network', cause: error })
    if (failure.is('sign-in-failed')) return showMessage('auth.passkey.failed')
    if (failure.is('sign-in-expired')) return showMessage('auth.passkey.expired')
    problem.value = failure
    if (failure.is('too-many-requests')) throttle.start(failure.retryAfter)
    else announce(problemMessage(failure), { assertive: true })
  }

  async function signIn(): Promise<void> {
    if (pending.value || throttle.active.value) return
    options.onStart?.()
    pending.value = true
    clear()
    let signedIn = false
    try {
      // onStart has aborted the autofill request; getAssertion aborts any other ceremony (R14).
      const { challenge } = await createPasskeyChallenge()
      const credential = await getAssertion(challenge.publicKey)
      const role = options.role()
      const session = await createSessionWithPasskey({ credential, ...(role ? { role } : {}) })
      signedIn = true
      await acceptSession(session)
    } catch (error) {
      report(error)
    } finally {
      pending.value = false
      if (!signedIn) options.onSettled?.()
    }
  }

  return { pending, problem, messageKey, throttle, signIn, report }
}
