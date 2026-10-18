// The query policy (research R8, R9). Nothing refetches by itself: no focus or reconnect
// refetches and no intervals, because automatic requests would keep an idle session alive
// (FR-033). Queries are retried once after a network error or a non-problem 5xx; mutations never.
// Session-level problems are dispatched to the reactions the session module registers.
import { MutationCache, QueryCache, QueryClient } from '@tanstack/vue-query'

import { ApiProblem } from '../problem'
import { queryKeys } from './keys'

export interface SessionReactions {
  /** `unauthenticated`: the session has ended (FR-034). */
  unauthenticated(problem: ApiProblem): void
  /** `second-factor-required`: refresh the session and go to the second-factor step. */
  secondFactorRequired(problem: ApiProblem): void
  /** `pending-action-required`: refresh session and identity, go to the pending-actions screen. */
  pendingActionRequired(problem: ApiProblem): void
  /** `forbidden`: show "no permission" in context and refresh the identity (FR-045). */
  forbidden(problem: ApiProblem): void
}

let reactions: SessionReactions | null = null

/** Registered by the session module at start; tests pass their own or null. */
export function setSessionReactions(next: SessionReactions | null): void {
  reactions = next
}

function dispatch(error: unknown): void {
  if (!(error instanceof ApiProblem) || !reactions) return
  if (error.is('unauthenticated')) reactions.unauthenticated(error)
  else if (error.is('second-factor-required')) reactions.secondFactorRequired(error)
  else if (error.is('pending-action-required')) reactions.pendingActionRequired(error)
  else if (error.is('forbidden')) reactions.forbidden(error)
}

/** Retry once after a network error or a non-problem 5xx; never after a 4xx or a problem. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1 || !(error instanceof ApiProblem)) return false
  return error.kind === 'network' || error.kind === 'unavailable'
}

export function createQueryClient(options: { retryDelay?: number } = {}): QueryClient {
  const client = new QueryClient({
    queryCache: new QueryCache({ onError: dispatch }),
    mutationCache: new MutationCache({ onError: dispatch }),
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
  return client
}

/** The app's single QueryClient. */
export const queryClient = createQueryClient()
