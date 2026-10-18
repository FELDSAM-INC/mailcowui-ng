// The sign-in steps (T076, data-model §3, research R11). Each step's session answer is written
// into the `session` query. Only an `active` or `restricted` result reads the identity, applies
// the profile preferences and tells the other tabs (`session-changed`); then the router guard
// routes on the new state: the second-factor step, the pending actions, or the requested page.
import {
  api,
  queryKeys,
  requireData,
  type PasskeySignInRequest,
  type PasswordSignInRequest,
  type SecondFactorVerification,
  type Session,
  type WebAuthnChallenge,
  type Writable,
} from '@/api'
import { usePreferencesStore } from '@/app/preferences/store'
import { sessionContext } from '@/app/session/context'
import {
  anonymousSession,
  cachedSession,
  identityQuery,
  isSignedIn,
  recordSessionClock,
} from '@/app/session/queries'
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

/**
 * Takes a sign-in step's session: writes it, and for a signed-in session reads the identity,
 * applies the profile preferences and tells the other tabs. Then the guard routes.
 */
export async function acceptSession(session: Session): Promise<void> {
  const ctx = sessionContext()
  ctx.queryClient.setQueryData(queryKeys.session(), session)
  if (isSignedIn(session)) {
    useSessionStore().keptUsername = null
    try {
      const identity = await ctx.queryClient.fetchQuery({ ...identityQuery(), staleTime: 0 })
      if (identity.preferences) await usePreferencesStore().applyProfile(identity.preferences)
    } catch {
      // The guard reads the identity again on the next navigation.
    }
    ctx.channel.post({ v: 1, type: 'session-changed' })
  }
  await rerouteCurrent(ctx.router)
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
