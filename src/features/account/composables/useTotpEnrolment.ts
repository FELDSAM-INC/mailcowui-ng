// The TOTP enrolment (UI 005 data-model §7, research R10): started at once, held in component state
// only (never a query cache), confirmed with a name, a code and the current password. A wrong code
// keeps the same key with the attempts left; an expired enrolment, the last wrong attempt or the
// local countdown (with the server clock skew) ends in `expired`, which can start again. The
// enrolment is discarded on success, on cancel, on expiry and when the component goes away.
import { computed, onScopeDispose, ref, shallowRef } from 'vue'

import type { ApiProblem, OwnSecondFactor, OwnTotpEnrolment } from '@/api'
import { useCountdown } from '@/shared/composables/useCountdown'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'

import { enrolSecondFactor, startTotpEnrolment } from '../api/second-factors'

export type TotpState = 'starting' | 'shown' | 'confirming' | 'expired' | 'done' | 'failed'

export function useTotpEnrolment() {
  const state = ref<TotpState>('starting')
  const enrolment = shallowRef<OwnTotpEnrolment | null>(null)
  const skew = ref(0)
  /** The problem of the last confirmation (on the code or the password field). */
  const problem = shallowRef<ApiProblem | null>(null)
  const startRequest = useSecretRequest(startTotpEnrolment)
  const confirmRequest = useSecretRequest(enrolSecondFactor)

  const countdown = useCountdown({
    deadline: () => (state.value === 'shown' ? (enrolment.value?.expiresAt ?? null) : null),
    skew: () => skew.value,
    onExpire: () => expire(),
  })

  function discard() {
    enrolment.value = null
    startRequest.clear()
    confirmRequest.clear()
  }

  function expire() {
    discard()
    state.value = 'expired'
  }

  async function start(): Promise<void> {
    discard()
    problem.value = null
    state.value = 'starting'
    const result = await startRequest.run()
    if (!result) {
      problem.value = startRequest.problem.value
      state.value = 'failed'
      return
    }
    enrolment.value = result.enrolment
    skew.value = result.skew
    startRequest.clear()
    state.value = 'shown'
  }

  /** Confirms with a name, a six-digit code and (outside forced setup) the current password. */
  async function confirm(input: {
    name: string
    code: string
    currentPassword?: string
  }): Promise<OwnSecondFactor | null> {
    if (state.value !== 'shown' || !enrolment.value) return null
    state.value = 'confirming'
    problem.value = null
    const entry = await confirmRequest.run({
      type: 'totp',
      name: input.name,
      code: input.code,
      ...(input.currentPassword !== undefined ? { currentPassword: input.currentPassword } : {}),
    })
    if (entry) {
      discard()
      state.value = 'done'
      return entry
    }
    const failure = confirmRequest.problem.value
    problem.value = failure
    if (
      failure?.is('second-factor-enrolment-expired') ||
      (failure?.is('second-factor-enrolment-failed') && failure.attemptsRemaining === 0)
    ) {
      expire()
      return null
    }
    state.value = enrolment.value ? 'shown' : 'expired'
    return null
  }

  onScopeDispose(discard)

  return {
    state,
    enrolment,
    problem,
    remaining: countdown.remaining,
    pending: computed(() => state.value === 'starting' || state.value === 'confirming'),
    start,
    confirm,
    discard,
  }
}
