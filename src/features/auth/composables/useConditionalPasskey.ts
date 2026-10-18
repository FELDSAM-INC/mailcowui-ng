// Passkeys in the username autofill (FR-012, research R14). When the browser offers conditional
// mediation, the sign-in screen requests a challenge and starts a conditional get(), which never
// opens a dialog: the browser lists the passkeys when the username field is focused. The request
// restarts 30 s before its challenge expires while the page is visible, and when the page becomes
// visible again. It is aborted when the screen unmounts, when a modal ceremony starts (one
// ceremony at a time) and when the password form is submitted. These are anonymous requests, so
// they never keep a signed-in session alive (FR-033).
//
// The API keeps one passkey challenge per session: two pages on the sign-in screen take each
// other's. The losing page gets `sign-in-expired`, restarts silently and asks the user to choose
// the passkey again.
import { onMounted, onScopeDispose, ref } from 'vue'

import { isApiProblem, type Role } from '@/api'
import {
  abortCeremony,
  conditionalMediationAvailable,
  getAssertion,
  WebAuthnCeremonyError,
} from '@/shared/platform/webauthn'

import { acceptSession, createPasskeyChallenge, createSessionWithPasskey } from '../api'

/** The request restarts this long before its challenge expires. */
export const CONDITIONAL_RESTART_MARGIN_MS = 30_000

export interface ConditionalPasskeyOptions {
  role: () => Role | null
  /** A failure to show: a refused passkey, throttling, a lost connection. */
  onError: (error: unknown) => void
}

export function useConditionalPasskey(options: ConditionalPasskeyOptions) {
  /** Set after a silent restart because the challenge was taken: "Choose your passkey again." */
  const chooseAgain = ref(false)
  const active = ref(false)
  let available = false
  let stopped = true
  let generation = 0
  let restartAt: number | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer() {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  function schedule(expiresAt: string, skew: number) {
    clearTimer()
    const deadline = new Date(expiresAt).getTime() - skew - CONDITIONAL_RESTART_MARGIN_MS
    restartAt = deadline
    timer = setTimeout(
      () => {
        if (document.visibilityState !== 'hidden') void run()
      },
      Math.max(0, deadline - Date.now()),
    )
  }

  async function run(): Promise<void> {
    if (!available) return
    stopped = false
    const mine = ++generation
    abortCeremony()
    active.value = true
    let picked = false
    try {
      const { challenge, skew } = await createPasskeyChallenge()
      if (stopped || mine !== generation) return
      schedule(challenge.expiresAt, skew)
      const credential = await getAssertion(challenge.publicKey, { mediation: 'conditional' })
      if (mine !== generation) return
      picked = true
      clearTimer()
      const role = options.role()
      const session = await createSessionWithPasskey({ credential, ...(role ? { role } : {}) })
      stop()
      await acceptSession(session)
    } catch (error) {
      if (mine !== generation || stopped) return
      // Before the user picked a passkey, failures stay silent: the request restarts with its
      // timer or when the page becomes visible, and the passkey action still works. An aborted
      // request is restarted by whoever aborted it.
      if (!picked) {
        if (!(error instanceof WebAuthnCeremonyError)) clearTimer()
        return
      }
      if (isApiProblem(error) && error.is('sign-in-expired')) {
        chooseAgain.value = true
        return void run()
      }
      options.onError(error)
      if (isApiProblem(error) && error.is('sign-in-failed')) void run()
    }
  }

  /** Starts (or restarts) the conditional request, when the browser offers it. */
  function start(): void {
    void run()
  }

  /** Aborts the conditional request (password submit, unmount). */
  function stop(): void {
    stopped = true
    generation += 1
    active.value = false
    clearTimer()
    abortCeremony()
  }

  function onVisibility() {
    if (document.visibilityState === 'hidden' || stopped) return
    if (restartAt === null || Date.now() >= restartAt) void run()
  }

  onMounted(async () => {
    available = await conditionalMediationAvailable()
    if (available) void run()
  })
  document.addEventListener('visibilitychange', onVisibility)
  onScopeDispose(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    if (!stopped) stop()
  })

  return { active, chooseAgain, start, stop }
}
