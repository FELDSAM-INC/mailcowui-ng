// The query policy (research R8, R9). Nothing refetches by itself: no focus or reconnect
// refetches and no intervals, because automatic requests would keep an idle session alive
// (FR-033). Queries are retried once after a network error or a non-problem 5xx; mutations never.
// Session-level problems are dispatched to the reactions the session module registers.
import { MutationCache, QueryCache, QueryClient } from '@tanstack/vue-query'

import { ApiProblem } from '../problem'
import { queryKeys } from './keys'

export interface SessionReactions {
  /** UI007: the server restored the original actor; the refused request must never replay. */
  impersonationEnded?(problem: ApiProblem): void
  /** `unauthenticated`: the session has ended (FR-034). */
  unauthenticated(problem: ApiProblem): void
  /** `second-factor-required`: refresh the session and go to the second-factor step. */
  secondFactorRequired(problem: ApiProblem): void
  /** `pending-action-required`: refresh session and identity, go to the pending-actions screen. */
  pendingActionRequired(problem: ApiProblem): void
  /**
   * `forbidden`: show "no permission" in context and refresh the identity (FR-045). UI 004
   * (FR-004): `attribute-not-permitted` and `permission-flag-required` also come here, so that
   * changed permission flags update the controls.
   */
  forbidden(problem: ApiProblem): void
  /**
   * UI 012 (FR-052): `identity-provider-session-ended`: the single sign-on session has ended; end
   * it with the single sign-on notice. Without this reaction it is handled as `unauthenticated`.
   */
  identityProviderSessionEnded?(problem: ApiProblem): void
}

let reactions: SessionReactions | null = null
const endedActingProblems = new WeakSet<ApiProblem>()

/** Registered by the session module at start; tests pass their own or null. */
export function setSessionReactions(next: SessionReactions | null): void {
  reactions = next
}

/**
 * Passes a session-level problem to the registered reactions. The caches call it for every failed
 * query and mutation; requests that bypass the caches (secrets, useSecretRequest) call it too.
 */
export function reportSessionProblem(error: unknown): void {
  if (!(error instanceof ApiProblem) || !reactions) return
  if (error.is('impersonation-ended')) {
    if (endedActingProblems.has(error)) return
    endedActingProblems.add(error)
    reactions.impersonationEnded?.(error)
  } else if (error.is('unauthenticated')) reactions.unauthenticated(error)
  else if (error.is('identity-provider-session-ended')) {
    if (reactions.identityProviderSessionEnded) reactions.identityProviderSessionEnded(error)
    else reactions.unauthenticated(error)
  } else if (error.is('second-factor-required')) reactions.secondFactorRequired(error)
  else if (error.is('pending-action-required')) reactions.pendingActionRequired(error)
  else if (
    error.is('forbidden') ||
    error.is('attribute-not-permitted') ||
    error.is('permission-flag-required')
  ) {
    reactions.forbidden(error)
  }
}

/** Retry once after a network error or a non-problem 5xx; never after a 4xx or a problem. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1 || !(error instanceof ApiProblem)) return false
  return error.kind === 'network' || error.kind === 'unavailable'
}

export function createQueryClient(options: { retryDelay?: number } = {}): QueryClient {
  const client = new QueryClient({
    queryCache: new QueryCache({ onError: reportSessionProblem }),
    mutationCache: new MutationCache({ onError: reportSessionProblem }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 300_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: shouldRetryQuery,
        retryDelay: options.retryDelay ?? 1000,
      },
      mutations: {
        retry: false,
      },
    },
  })
  // The session changes only through answers the app handles itself, and it is never garbage
  // collected: the idle timer and the guard read it even while no component observes it.
  client.setQueryDefaults(queryKeys.session(), { staleTime: Infinity, gcTime: Infinity })
  // UI013 FR108: full job details contain message bodies. Apply the lifetime before any
  // create/cancel response primes this key; later observers cannot shorten an existing GC timer.
  // List summaries keep the ordinary cache policy.
  client.setQueryDefaults(queryKeys.massMailJobs.details(), { gcTime: 0 })
  return client
}

/** The app's single QueryClient. */
export const queryClient = createQueryClient()
