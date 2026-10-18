// The second-factor step (FR-020–FR-029, data-model §7). Methods come in the server's order;
// advanced methods (Yubico OTP) sit behind "Other methods" unless no primary method exists. Codes
// are checked before they are sent, so that a slip in their length does not cancel the sign-in.
// The outcome table decides between the password step, staying in the step, or a silent return.
import { onScopeDispose, ref, shallowRef, computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  ApiProblem,
  isApiProblem,
  type SecondFactorMethod,
  type SecondFactorType,
  type SecondFactorVerification,
  type Writable,
} from '@/api'
import { useSessionQuery } from '@/app/session/queries'
import type { SessionNotice } from '@/app/session/store'
import { useProblemMessages } from '@/i18n/problems'
import { announce } from '@/shared/composables/useAnnouncer'
import {
  abortCeremony,
  getAssertion,
  WebAuthnCeremonyError,
  webAuthnMessageKey,
} from '@/shared/platform/webauthn'

import {
  acceptSession,
  cancelPendingSignIn,
  createSecondFactorChallenge,
  returnToPasswordStep,
  verifySecondFactor,
} from '../api'

export interface MethodSection {
  type: SecondFactorType
  tier: SecondFactorMethod['tier']
  methods: SecondFactorMethod[]
}

/** Methods grouped by type, in the server's order (FR-020). */
export function groupMethods(methods: readonly SecondFactorMethod[]) {
  const sections: MethodSection[] = []
  for (const method of methods) {
    let section = sections.find((candidate) => candidate.type === method.type)
    if (!section) {
      section = { type: method.type, tier: method.tier, methods: [] }
      sections.push(section)
    }
    section.methods.push(method)
  }
  const primary = methods.filter((method) => method.tier === 'primary')
  const advanced = methods.filter((method) => method.tier !== 'primary')
  return {
    sections,
    primary,
    advanced,
    primarySections: sections.filter((section) => section.tier === 'primary'),
    advancedSections: sections.filter((section) => section.tier !== 'primary'),
    /** No primary method: advanced methods are shown directly. */
    advancedDirect: primary.length === 0,
  }
}

export function normaliseCode(value: string): string {
  return value.replace(/\s+/g, '')
}

export function isTotpCode(code: string): boolean {
  return /^[0-9]{6}$/.test(code)
}

export function isYubiOtp(otp: string): boolean {
  return /^[A-Za-z0-9]{44}$/.test(otp)
}

export type StepOutcome =
  | { kind: 'restart'; notice: SessionNotice }
  | { kind: 'stay'; problem: ApiProblem }
  | { kind: 'stay'; messageKey: string }
  | { kind: 'silent' }

/** What a failed step does next (data-model §7). */
export function stepOutcome(error: unknown): StepOutcome {
  if (error instanceof WebAuthnCeremonyError) {
    const messageKey = webAuthnMessageKey(error.kind)
    return messageKey ? { kind: 'stay', messageKey } : { kind: 'silent' }
  }
  if (isApiProblem(error)) {
    if (error.is('second-factor-failed')) return { kind: 'restart', notice: 'secondFactorRejected' }
    if (error.is('sign-in-expired')) return { kind: 'restart', notice: 'signInTimedOut' }
    if (error.is('second-factor-unavailable')) {
      return { kind: 'restart', notice: 'secondFactorUnavailable' }
    }
    return { kind: 'stay', problem: error }
  }
  return { kind: 'stay', problem: ApiProblem.fromParts({ kind: 'network', cause: error }) }
}

export function useSecondFactor() {
  const { t } = useI18n()
  const { problemMessage } = useProblemMessages()
  const sessionQuery = useSessionQuery()
  const session = computed(() => sessionQuery.data.value)
  const pendingSignIn = computed(() =>
    session.value?.state === 'pendingSecondFactor' ? (session.value.pendingSignIn ?? null) : null,
  )
  const groups = computed(() => groupMethods(pendingSignIn.value?.methods ?? []))
  const busy = ref<SecondFactorType | 'cancel' | null>(null)
  const problem = shallowRef<ApiProblem | null>(null)
  const messageKey = ref<string | null>(null)
  let leaving = false

  async function settle(error: unknown): Promise<void> {
    const outcome = stepOutcome(error)
    if (outcome.kind === 'restart') {
      leaving = true
      await returnToPasswordStep(outcome.notice)
    } else if (outcome.kind === 'stay') {
      if ('problem' in outcome) {
        problem.value = outcome.problem
        announce(problemMessage(outcome.problem), { assertive: true })
      } else {
        messageKey.value = outcome.messageKey
        announce(t(outcome.messageKey), { assertive: true })
      }
    }
  }

  async function run(type: SecondFactorType, step: () => Promise<void>): Promise<void> {
    if (busy.value || leaving) return
    busy.value = type
    problem.value = null
    messageKey.value = null
    try {
      await step()
    } catch (error) {
      await settle(error)
    } finally {
      busy.value = null
    }
  }

  function verify(body: Writable<SecondFactorVerification>): Promise<void> {
    return run(body.type, async () => {
      const next = await verifySecondFactor(body)
      leaving = true
      await acceptSession(next)
    })
  }

  function verifyWithWebAuthn(): Promise<void> {
    return run('webauthn', async () => {
      const challenge = await createSecondFactorChallenge()
      const credential = await getAssertion(challenge.publicKey)
      const next = await verifySecondFactor({ type: 'webauthn', credential })
      leaving = true
      await acceptSession(next)
    })
  }

  async function leave(notice: SessionNotice | null, keepUsername: boolean): Promise<void> {
    if (leaving) return
    leaving = true
    abortCeremony()
    try {
      await cancelPendingSignIn()
    } catch {
      // Idempotent on the server; an unreachable server lets the step expire there by itself.
    }
    await returnToPasswordStep(notice, { keepUsername })
  }

  /** "Cancel" (FR-026): back to the sign-in screen, without a message. */
  async function cancel(): Promise<void> {
    busy.value = 'cancel'
    try {
      await leave(null, false)
    } finally {
      busy.value = null
    }
  }

  /** The time limit has passed (FR-025). */
  function expire(): Promise<void> {
    return leave('signInTimedOut', true)
  }

  onScopeDispose(abortCeremony)

  return {
    session,
    pendingSignIn,
    groups,
    busy,
    problem,
    messageKey,
    verify,
    verifyWithWebAuthn,
    cancel,
    expire,
  }
}
