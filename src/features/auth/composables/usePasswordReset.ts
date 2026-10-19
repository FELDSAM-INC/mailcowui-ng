// The reset page's state machine (UI 005 data-model §7, research R12): the token taken from the
// holder is checked; a valid link shows the signed-in warning (FR-042) when a session is open, then
// the password step; the completion is sent without a second factor first, so the password rules
// are judged before a code is spent; `second-factor-required` opens the factor step with the
// methods of sign-in; the proof is sent with the password again. Every request carries the token,
// so all run through `useSecretRequest`, the completion without the session reactions (its 401 is
// the reset's, not a pending sign-in's). The countdown to the expiry ends in the invalid state.
// After the reset the session is read again; if it ended here, the local session end runs without
// leaving the page.
import { computed, onScopeDispose, ref, shallowRef } from 'vue'

import {
  queryKeys,
  type ApiProblem,
  type PasswordResetCompletionRequest,
  type PasswordResetTokenInfo,
  type SecondFactorMethod,
  type SecondFactorVerification,
  type Writable,
} from '@/api'
import { sessionContext } from '@/app/session/context'
import { cachedSession, fetchSession } from '@/app/session/queries'
import { endSession } from '@/app/session/session-end'
import { useCountdown } from '@/shared/composables/useCountdown'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { getAssertion } from '@/shared/platform/webauthn'

import {
  checkPasswordResetToken,
  completePasswordReset,
  createPasswordResetWebAuthnChallenge,
} from '../api'
import { clearResetToken, takeResetToken } from '../reset-token'

export type ResetState =
  | 'checking'
  | 'invalid'
  | 'unavailable'
  | 'askAdministrator'
  | 'warning'
  | 'password'
  | 'completing'
  | 'factor'
  | 'done'

export function usePasswordReset() {
  const state = ref<ResetState>('checking')
  const info = shallowRef<PasswordResetTokenInfo | null>(null)
  const methods = shallowRef<SecondFactorMethod[]>([])
  const problem = shallowRef<ApiProblem | null>(null)
  /** The current session's username when a session is open (FR-042). */
  const signedInAs = ref<string | null>(null)
  const skew = ref(0)
  let token: string | null = null
  /** The password of the password step, kept for the factor step only. */
  let password: string | null = null

  const check = useSecretRequest(checkPasswordResetToken, { sessionReactions: false })
  const complete = useSecretRequest(completePasswordReset, { sessionReactions: false })
  const challenge = useSecretRequest(createPasswordResetWebAuthnChallenge, {
    sessionReactions: false,
  })

  const countdown = useCountdown({
    deadline: () =>
      ['warning', 'password', 'completing', 'factor'].includes(state.value)
        ? (info.value?.expiresAt ?? null)
        : null,
    skew: () => skew.value,
    onExpire: () => invalidate(),
  })

  function forget() {
    token = null
    password = null
    clearResetToken()
  }

  function invalidate() {
    forget()
    state.value = 'invalid'
  }

  async function start(): Promise<void> {
    token = takeResetToken()
    if (!token) {
      state.value = 'invalid'
      return
    }
    const ctx = sessionContext()
    const session = cachedSession(ctx.queryClient)
    signedInAs.value =
      session && (session.state === 'active' || session.state === 'restricted')
        ? (session.username ?? null)
        : null
    const result = await check.run(token)
    if (!result) return fail(check.problem.value)
    info.value = result.info
    skew.value = result.skew
    check.clear()
    if (result.info.secondFactorRequired && result.info.secondFactorMethods.length === 0) {
      forget()
      state.value = 'askAdministrator'
      return
    }
    state.value = signedInAs.value ? 'warning' : 'password'
  }

  function fail(failure: ApiProblem | null) {
    problem.value = failure
    if (failure?.is('invalid-reset-token')) return invalidate()
    if (failure?.is('password-reset-unavailable')) {
      forget()
      state.value = 'unavailable'
      return
    }
    if (failure?.is('second-factor-unavailable')) {
      forget()
      state.value = 'askAdministrator'
    }
  }

  function proceed() {
    if (state.value === 'warning') state.value = 'password'
  }

  async function send(body: Writable<PasswordResetCompletionRequest>): Promise<void> {
    const done = await complete.run(body)
    if (done) {
      forget()
      state.value = 'done'
      await afterReset()
      return
    }
    const failure = complete.problem.value
    problem.value = failure
    if (failure?.is('second-factor-required')) {
      methods.value = failure.methods
      state.value = 'factor'
      problem.value = null
      return
    }
    fail(failure)
  }

  /** The password step: the rules are judged before any second factor. */
  async function submitPassword(newPassword: string): Promise<void> {
    if (!token || state.value !== 'password') return
    problem.value = null
    state.value = 'completing'
    password = newPassword
    await send({ token, newPassword })
    if (state.value === 'completing') state.value = 'password'
  }

  /** The factor step: the proof with the password again. */
  async function submitFactor(secondFactor: Writable<SecondFactorVerification>): Promise<void> {
    if (!token || !password || state.value !== 'factor') return
    problem.value = null
    state.value = 'completing'
    await send({ token, newPassword: password, secondFactor })
    if (state.value === 'completing') state.value = 'factor'
  }

  /** A security key: the reset's own challenge, then the proof. */
  async function submitWebAuthn(): Promise<void> {
    if (!token) return
    const options = await challenge.run(token)
    if (!options) return fail(challenge.problem.value)
    try {
      const credential = await getAssertion(options.publicKey)
      await submitFactor({ type: 'webauthn', credential })
    } catch {
      // A cancelled prompt keeps the step.
    }
  }

  /** The reset ended every session of the account: this browser's too when it was that account. */
  async function afterReset(): Promise<void> {
    const ctx = sessionContext()
    const before = cachedSession(ctx.queryClient)
    if (!before || before.state === 'anonymous') return
    try {
      const session = await fetchSession()
      if (session.state === 'anonymous') {
        await endSession(ctx, { broadcast: true, stay: true })
      } else ctx.queryClient.setQueryData(queryKeys.session(), session)
    } catch {
      // The guard reads the session again on the next navigation.
    }
  }

  onScopeDispose(forget)

  return {
    state,
    info,
    methods,
    problem,
    signedInAs,
    remaining: countdown.remaining,
    busy: computed(() => state.value === 'completing' || check.pending.value),
    start,
    proceed,
    submitPassword,
    submitFactor,
    submitWebAuthn,
    forget,
  }
}
