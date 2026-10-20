// The `session` and `identity` queries (data-model §3, research R9, R11).
import { queryOptions, useQuery, type QueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import { api, queryKeys, requireData, type Identity, type Session } from '@/api'
import { computeSkew } from '@/shared/composables/useCountdown'

import { useSessionStore } from './store'

/** FR-050: the identity is refreshed when a section opens and it is older than this. */
export const IDENTITY_MAX_AGE = 300_000

/** Records the server clock skew from the `Date` header of a response that carries a session. */
export function recordSessionClock(response: Response): void {
  const header = response.headers.get('date')
  const skew = computeSkew(header ? new Date(header) : null)
  try {
    useSessionStore().clockSkew = skew
  } catch {
    // No active Pinia (a script outside the app): nothing counts down.
  }
}

export async function fetchSession(): Promise<Session> {
  const result = await api.GET('/session')
  recordSessionClock(result.response)
  return requireData(result).data
}

export async function fetchIdentity(): Promise<Identity> {
  return requireData(await api.GET('/me')).data
}

/** The session changes only through responses the app handles itself: never stale. */
export function sessionQuery() {
  return queryOptions({
    queryKey: queryKeys.session(),
    queryFn: fetchSession,
    staleTime: Infinity,
  })
}

export function identityQuery() {
  return queryOptions({
    queryKey: queryKeys.identity(),
    queryFn: fetchIdentity,
    staleTime: IDENTITY_MAX_AGE,
  })
}

/** An anonymous session, as the server reports one after a sign-out or an expiry. */
export function anonymousSession(idleTimeout: number): Session {
  return { state: 'anonymous', pendingActions: [], idleTimeout }
}

export function isSignedIn(session: Session | undefined): boolean {
  return session?.state === 'active' || session?.state === 'restricted'
}

export function cachedSession(queryClient: QueryClient): Session | undefined {
  return queryClient.getQueryData(queryKeys.session())
}

export function cachedIdentity(queryClient: QueryClient): Identity | undefined {
  return queryClient.getQueryData(queryKeys.identity())
}

export function useSessionQuery() {
  const store = useSessionStore()
  return useQuery(
    computed(() => ({ ...sessionQuery(), meta: { identityGeneration: store.identityGeneration } })),
  )
}

/** The identity, fetched only for active or restricted sessions. */
export function useIdentityQuery(enabled: MaybeRefOrGetter<boolean> = true) {
  const store = useSessionStore()
  return useQuery(
    computed(() => ({
      ...identityQuery(),
      enabled: toValue(enabled),
      meta: { identityGeneration: store.identityGeneration },
    })),
  )
}
