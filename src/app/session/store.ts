// Client state of the session lifecycle (data-model §4, research R10). Server state (the session
// and the identity) lives in the query cache; nothing here is ever written to device storage.
import { defineStore } from 'pinia'
import { ref } from 'vue'

export type SessionNotice =
  | 'signedOut'
  | 'sessionEnded'
  | 'signInTimedOut'
  | 'secondFactorRejected'
  | 'secondFactorUnavailable'
  // UI 012: the single sign-on session ended (FR-052); signed out of one (FR-053).
  | 'ssoSessionEnded'
  | 'signedOutSso'

export const DEFAULT_IDLE_TIMEOUT = 10_800

export const useSessionStore = defineStore('session', () => {
  /** Kept when a sign-in returns to the password step (FR-024, FR-025). Memory only (FR-091). */
  const keptUsername = ref<string | null>(null)
  /** A validated in-app path to open after sign-in (FR-031, FR-092). */
  const returnTo = ref<string | null>(null)
  /** One-shot message for the sign-in screen. */
  const notice = ref<SessionNotice | null>(null)
  /** Epoch ms of the newest API response in any tab (research R12). */
  const lastActivityAt = ref(Date.now())
  /** Seconds, from `Session.idleTimeout`. */
  const idleTimeout = ref(DEFAULT_IDLE_TIMEOUT)
  const idleWarningOpen = ref(false)
  /**
   * Server clock minus device clock in ms, from the `Date` header of the last session response
   * (research R13). Deadlines such as `PendingSignIn.expiresAt` count down against it.
   */
  const clockSkew = ref(0)

  function recordActivity(at: number) {
    if (at > lastActivityAt.value) lastActivityAt.value = at
    idleWarningOpen.value = false
  }

  function consumeNotice(): SessionNotice | null {
    const value = notice.value
    notice.value = null
    return value
  }

  /** Forgets everything of the previous session (sign-out, session end). */
  function reset() {
    keptUsername.value = null
    returnTo.value = null
    idleWarningOpen.value = false
  }

  return {
    keptUsername,
    returnTo,
    notice,
    lastActivityAt,
    idleTimeout,
    idleWarningOpen,
    clockSkew,
    recordActivity,
    consumeNotice,
    reset,
  }
})
