// Passkeys in the username autofill (FR-012, research R14). When the browser offers conditional
// mediation, the sign-in screen requests a challenge and starts a conditional get(), which never
// opens a dialog: the browser lists the passkeys at the username field. These are anonymous
// requests, so they never keep a signed-in session alive (FR-033).
//
// One request stays pending for as long as the screen is shown (UI 001 fix, 2026-10-19). While
// the user picks a passkey, iOS shows its passkey sheet and the page loses focus or visibility; a
// request the app aborts or replaces at that moment drops the user's choice, and a request that
// has settled leaves the field offering passkeys that do nothing. So:
// - Focus, blur and visibility changes, reconnects, re-renders and session refetches never abort
//   or restart it.
// - It restarts when it settles without a credential (the user dismissed the browser's prompt, or
//   the browser gave up or aborted it), after a refused attempt, and 30 s before its challenge
//   expires. A request that fails at once is retried with a growing delay. A restart that falls
//   due while the page is hidden runs when the page is visible again.
// - It is aborted when the screen unmounts, before the passkey action's modal ceremony and a
//   single sign-on start (which resume it when they do not sign in or leave the page), and when
//   the password form is submitted. It never takes the authenticator from another ceremony.
//
// The API keeps one passkey challenge per session: two pages on the sign-in screen take each
// other's. The losing page gets `sign-in-expired`, restarts silently and asks the user to choose
// the passkey again.
import { onMounted, onScopeDispose, ref } from 'vue'

import { isApiProblem, type Role, type WebAuthnAuthenticationResponse } from '@/api'
import {
  abortCeremony,
  conditionalMediationAvailable,
  getAssertion,
  isCeremonyRunning,
  WebAuthnCeremonyError,
} from '@/shared/platform/webauthn'

import { acceptSession, createPasskeyChallenge, createSessionWithPasskey } from '../api'

/** The request restarts this long before its challenge expires. */
export const CONDITIONAL_RESTART_MARGIN_MS = 30_000

/** A request that settles sooner than this after it started has failed at once. */
export const CONDITIONAL_QUICK_FAILURE_MS = 3_000

/** Delays before restarting after consecutive failures at once; the last one repeats. */
export const CONDITIONAL_RETRY_DELAYS_MS = [1_000, 5_000, 15_000, 60_000] as const

/** The shortest time a request runs before it is renewed for its challenge's expiry. */
const MIN_RENEWAL_MS = 5_000

export interface ConditionalPasskeyOptions {
  role: () => Role | null
  /** A failure to show: a refused passkey, throttling, a lost connection. */
  onError: (error: unknown) => void
}

/**
 * - `idle`: no request (before the start, stopped, or left to another ceremony).
 * - `starting`: the challenge is being requested.
 * - `pending`: the conditional get() waits for the user.
 * - `submitting`: the user picked a passkey and the assertion is on its way.
 */
type Phase = 'idle' | 'starting' | 'pending' | 'submitting'

export function useConditionalPasskey(options: ConditionalPasskeyOptions) {
  /** Set after a silent restart because the challenge was taken: "Choose your passkey again." */
  const chooseAgain = ref(false)
  const active = ref(false)
  let available = false
  let disposed = false
  /** Set by stop() and cleared by start(): the screen's owner has taken the request away. */
  let stopped = false
  let phase: Phase = 'idle'
  let generation = 0
  /** Consecutive requests that failed at once. */
  let failures = 0
  /** When the next restart is due (before the challenge expires, or a retry), or null. */
  let restartAt: number | null = null
  /** The restart timer fired while the page was hidden. */
  let overdue = false
  let timer: ReturnType<typeof setTimeout> | null = null

  function cancelRestart() {
    if (timer !== null) clearTimeout(timer)
    timer = null
    restartAt = null
    overdue = false
  }

  function restartLater(at: number) {
    cancelRestart()
    restartAt = at
    timer = setTimeout(
      () => {
        timer = null
        overdue = true
        restartIfDue()
      },
      Math.max(0, at - Date.now()),
    )
  }

  /**
   * Runs a restart that has fallen due, once the page is visible. Visibility alone never restarts
   * the request: without a due restart this does nothing.
   */
  function restartIfDue() {
    if (stopped || restartAt === null || phase === 'submitting') return
    if (!overdue && Date.now() < restartAt) return
    if (document.visibilityState === 'hidden') return
    // Another ceremony holds the authenticator; it resumes this request when it ends.
    if (phase !== 'pending' && isCeremonyRunning()) return
    void run()
  }

  /** The request settled without a credential: start the next one, later if it failed at once. */
  function settled(startedAt: number) {
    phase = 'idle'
    if (Date.now() - startedAt >= CONDITIONAL_QUICK_FAILURE_MS) {
      failures = 0
      restartLater(Date.now())
      return
    }
    failures += 1
    const delays = CONDITIONAL_RETRY_DELAYS_MS
    restartLater(Date.now() + delays[Math.min(failures, delays.length) - 1]!)
  }

  /** Leaves no request and schedules none: another ceremony took over, or passkeys cannot work. */
  function rest() {
    phase = 'idle'
    active.value = false
    cancelRestart()
  }

  async function run(): Promise<void> {
    if (!available || disposed || stopped) return
    const mine = ++generation
    cancelRestart()
    if (phase === 'pending') abortCeremony()
    phase = 'starting'
    active.value = true
    const startedAt = Date.now()
    const isCurrent = () => mine === generation && !stopped

    let challenge: Awaited<ReturnType<typeof createPasskeyChallenge>>
    try {
      challenge = await createPasskeyChallenge()
    } catch {
      // Silent: the passkey action still works, and the request is retried.
      if (isCurrent()) settled(startedAt)
      return
    }
    if (!isCurrent()) return
    // Never take the authenticator from another ceremony: whoever started it without stopping
    // this request first resumes it when that ceremony ends.
    if (isCeremonyRunning()) return rest()
    const { expiresAt, publicKey } = challenge.challenge
    // 30 s before the challenge expires; halfway through a shorter lifetime, and never in a loop.
    const lifetime = new Date(expiresAt).getTime() - challenge.skew - Date.now()
    const renewIn = Math.max(lifetime - CONDITIONAL_RESTART_MARGIN_MS, lifetime / 2)
    restartLater(Date.now() + Math.max(renewIn, MIN_RENEWAL_MS))
    phase = 'pending'

    let credential: WebAuthnAuthenticationResponse
    try {
      credential = await getAssertion(publicKey, { mediation: 'conditional' })
    } catch (error) {
      if (!isCurrent()) return
      if (error instanceof WebAuthnCeremonyError) {
        // Aborted by the app, but not here: the passkey action's ceremony took over.
        if (error.kind === 'aborted') return rest()
        if (error.kind === 'insecure' || error.kind === 'unsupported') return rest()
      }
      settled(startedAt)
      return
    }
    if (!isCurrent()) return
    await submit(credential, isCurrent, startedAt)
  }

  async function submit(
    credential: WebAuthnAuthenticationResponse,
    isCurrent: () => boolean,
    startedAt: number,
  ) {
    phase = 'submitting'
    cancelRestart()
    try {
      const role = options.role()
      const session = await createSessionWithPasskey({ credential, ...(role ? { role } : {}) })
      stop()
      await acceptSession(session)
    } catch (error) {
      if (!isCurrent()) return
      // An expired or replaced challenge is nothing the user did wrong: restart silently. The
      // restart is delayed too when the credential came at once (an authenticator answering by
      // itself would otherwise loop).
      if (isApiProblem(error) && error.is('sign-in-expired')) chooseAgain.value = true
      else options.onError(error)
      settled(startedAt)
    }
  }

  /** Starts (or restarts) the conditional request, when the browser offers it. */
  function start(): void {
    stopped = false
    void run()
  }

  /** Aborts the conditional request (password submit, modal ceremony, single sign-on, unmount). */
  function stop(): void {
    stopped = true
    generation += 1
    active.value = false
    cancelRestart()
    if (phase === 'pending') abortCeremony()
    phase = 'idle'
  }

  onMounted(async () => {
    available = await conditionalMediationAvailable()
    // Unless the passkey action or a password submit stopped it while the browser answered.
    if (available && !stopped) void run()
  })
  document.addEventListener('visibilitychange', restartIfDue)
  onScopeDispose(() => {
    disposed = true
    document.removeEventListener('visibilitychange', restartIfDue)
    stop()
  })

  return { active, chooseAgain, start, stop }
}
