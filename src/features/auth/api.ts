// The sign-in steps (T076, data-model §3, research R11). Each step's session answer is written
// into the `session` query. Only an `active` or `restricted` result reads the identity, applies
// the profile preferences and tells the other tabs (`session-changed`); then the router guard
// routes on the new state: the second-factor step, the pending actions, or the requested page.
import type { RouteLocationRaw } from 'vue-router'

import {
  api,
  queryKeys,
  requireData,
  type PasswordResetAcknowledgement,
  type PasswordResetCompleted,
  type PasswordResetCompletionRequest,
  type PasswordResetTokenInfo,
  type PasskeySignInRequest,
  type PasswordSignInRequest,
  type SecondFactorVerification,
  type Session,
  type SingleSignOnCompletionRequest,
  type SingleSignOnProviderErrorRequest,
  type SingleSignOnStart,
  type WebAuthnChallenge,
  type Writable,
} from '@/api'
import { invalidateSessionScope } from '@/api/session-scope'
import { applyProfileAfterSignIn } from '@/app/preferences/sync'
import { sessionContext } from '@/app/session/context'
import {
  anonymousSession,
  cachedSession,
  identityQuery,
  isSignedIn,
  recordSessionClock,
} from '@/app/session/queries'
import { continueAfterSignIn } from '@/app/session/landing'
import { rerouteCurrent } from '@/app/session/reroute'
import { useSessionStore, type SessionNotice } from '@/app/session/store'
import { computeSkew } from '@/shared/composables/useCountdown'

export async function createSession(body: Writable<PasswordSignInRequest>): Promise<Session> {
  const result = await api.POST('/session', { body })
  recordSessionClock(result.response)
  return requireData(result).data
}

export async function verifySecondFactor(
  body: Writable<SecondFactorVerification>,
): Promise<Session> {
  const result = await api.POST('/session/pending-sign-in/second-factor', { body })
  recordSessionClock(result.response)
  return requireData(result).data
}

/** A passkey challenge with the server clock skew of its answer (for its expiry, R13). */
export async function createPasskeyChallenge(): Promise<{
  challenge: WebAuthnChallenge
  skew: number
}> {
  const result = await api.POST('/session/passkey-challenge')
  const date = result.response.headers.get('date')
  return {
    challenge: requireData(result).data,
    skew: computeSkew(date ? new Date(date) : null),
  }
}

export async function createSessionWithPasskey(
  body: Writable<PasskeySignInRequest>,
): Promise<Session> {
  const result = await api.POST('/session/passkey-assertion', { body })
  recordSessionClock(result.response)
  return requireData(result).data
}

export async function createSecondFactorChallenge(): Promise<WebAuthnChallenge> {
  return requireData(await api.POST('/session/pending-sign-in/webauthn-challenge')).data
}

export async function cancelPendingSignIn(): Promise<void> {
  await api.DELETE('/session/pending-sign-in')
}

// UI 012 (research R4 to R6): single sign-on. Every call goes to the generated client directly,
// never through a query or mutation cache: the start's answer carries the provider's state in its
// authorization address, and the completion and the error report carry the provider's code and
// state (docs/conventions.md, "Secrets in requests or responses").

export async function startSingleSignOn(): Promise<SingleSignOnStart> {
  return requireData(await api.POST('/session/single-sign-on')).data
}

export async function cancelSingleSignOn(): Promise<void> {
  await api.DELETE('/session/single-sign-on')
}

export async function completeSingleSignOn(
  body: Writable<SingleSignOnCompletionRequest>,
): Promise<Session> {
  const result = await api.POST('/session/single-sign-on/completion', { body })
  recordSessionClock(result.response)
  return requireData(result).data
}

export async function reportSingleSignOnProviderError(
  body: Writable<SingleSignOnProviderErrorRequest>,
): Promise<void> {
  await api.POST('/session/single-sign-on/provider-error', { body })
}

/** The steps every signed-in session takes: identity, profile preferences, the other tabs. */
async function takeSignedInSession(session: Session): Promise<void> {
  const ctx = sessionContext()
  if (isSignedIn(session)) invalidateSessionScope()
  ctx.queryClient.setQueryData(queryKeys.session(), session)
  if (isSignedIn(session)) {
    useSessionStore().keptUsername = null
    try {
      const identity = await ctx.queryClient.fetchQuery({ ...identityQuery(), staleTime: 0 })
      await applyProfileAfterSignIn(identity)
      // A session expiry clears cached queries while mounted pages keep their observers. Those
      // observers may retain an error result and will not refetch just because the identity has
      // returned; refresh active page reads after authentication is restored.
      await ctx.queryClient.invalidateQueries()
    } catch {
      // The guard reads the identity again on the next navigation.
    }
    ctx.channel.post({ v: 1, type: 'session-changed' })
  }
}

/**
 * UI 012 (FR-047): takes the session of a completed single sign-on as any sign-in, then opens the
 * kept address or the home screen. `replace` keeps the return page out of the history; the guard
 * routes a session that is not active as usual.
 */
export async function acceptSingleSignOnSession(
  session: Session,
  target: RouteLocationRaw,
): Promise<void> {
  await takeSignedInSession(session)
  // UI 005 (research R20): an active session lands through the landing hooks.
  if (session.state === 'active') await continueAfterSignIn({ target })
  else await sessionContext().router.replace(target)
}

/**
 * Takes a sign-in step's session: writes it, and for a signed-in session reads the identity,
 * applies the profile preferences and tells the other tabs. Then the guard routes.
 */
export async function acceptSession(session: Session): Promise<void> {
  await takeSignedInSession(session)
  // UI 005 (research R20): an active session lands through `continueAfterSignIn()`, the guard
  // routes every other state.
  if (session.state === 'active') await continueAfterSignIn()
  else await rerouteCurrent(sessionContext().router)
}

/**
 * Leaves the second-factor step for the password step (FR-024, FR-025, FR-028): the username is
 * kept in memory, the sign-in screen explains why, and `returnTo` is carried along.
 */
export async function returnToPasswordStep(
  notice: SessionNotice | null,
  options: { keepUsername?: boolean } = {},
): Promise<void> {
  const ctx = sessionContext()
  const store = useSessionStore()
  const session = cachedSession(ctx.queryClient)
  if (options.keepUsername !== false && session?.username) store.keptUsername = session.username
  store.notice = notice
  ctx.queryClient.setQueryData(
    queryKeys.session(),
    anonymousSession(session?.idleTimeout ?? store.idleTimeout),
  )
  const returnTo = ctx.router.currentRoute.value.query.returnTo
  await ctx.router.replace({
    name: 'sign-in',
    query: typeof returnTo === 'string' ? { returnTo } : {},
  })
}

// UI 005 (research R12): the password reset before sign-in. The request carries only an address;
// the token check, the WebAuthn challenge and the completion carry the token (and the password), so
// callers run them through `useSecretRequest`, the completion without the session reactions.

export async function requestPasswordReset(address: string): Promise<PasswordResetAcknowledgement> {
  return requireData(await api.POST('/password-resets', { body: { address } })).data
}

export async function checkPasswordResetToken(token: string): Promise<{
  info: PasswordResetTokenInfo
  skew: number
}> {
  const result = await api.POST('/password-resets/token-check', { body: { token } })
  const date = result.response.headers.get('date')
  return { info: requireData(result).data, skew: computeSkew(date ? new Date(date) : null) }
}

export async function createPasswordResetWebAuthnChallenge(
  token: string,
): Promise<WebAuthnChallenge> {
  return requireData(await api.POST('/password-resets/webauthn-challenge', { body: { token } }))
    .data
}

export async function completePasswordReset(
  body: Writable<PasswordResetCompletionRequest>,
): Promise<PasswordResetCompleted> {
  return requireData(await api.POST('/password-resets/completion', { body })).data
}
