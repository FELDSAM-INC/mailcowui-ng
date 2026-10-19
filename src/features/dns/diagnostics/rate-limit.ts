// The diagnostics rate limit (research R14, FR-066, FR-091): the `RateLimit-*` headers of every
// answer, or a 429's `retryAfter`, as `{ limit, remaining, resetAt }` in the query cache (so that
// sign-out clears it); a notice from three runs left, and "Run again" blocked until the reset.
import type { ApiProblem } from '@/api'

export interface RateLimitState {
  limit: number
  remaining: number
  /** Epoch ms when the window resets. */
  resetAt: number
}

function integer(value: string | null): number | null {
  if (value === null || value.trim() === '') return null
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 ? number : null
}

export function rateLimitFromHeaders(headers: Headers, now = Date.now()): RateLimitState | null {
  const limit = integer(headers.get('RateLimit-Limit'))
  const remaining = integer(headers.get('RateLimit-Remaining'))
  const reset = integer(headers.get('RateLimit-Reset'))
  if (limit === null || remaining === null || reset === null) return null
  return { limit, remaining, resetAt: now + reset * 1000 }
}

export function rateLimitFromProblem(
  problem: ApiProblem,
  limit: number,
  now = Date.now(),
): RateLimitState | null {
  if (problem.status !== 429) return null
  return { limit, remaining: 0, resetAt: now + (problem.retryAfter ?? 60) * 1000 }
}

/** "N checks left this minute" from three down, while the window lasts. */
export function showRemaining(state: RateLimitState | undefined, now = Date.now()): boolean {
  return !!state && state.remaining <= 3 && state.resetAt > now
}

/** When no run is left: the time "Run again" is available again; otherwise null. */
export function blockedUntil(state: RateLimitState | undefined, now = Date.now()): number | null {
  return state && state.remaining === 0 && state.resetAt > now ? state.resetAt : null
}
