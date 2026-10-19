// The diagnostics rate limit (T056, research R14, FR-066, FR-091): the RateLimit headers as state,
// a 429 through its retryAfter, the "few runs left" notice and the block until the reset.
import { describe, expect, it } from 'vitest'

import { ApiProblem } from '@/api'
import {
  blockedUntil,
  rateLimitFromHeaders,
  rateLimitFromProblem,
  showRemaining,
} from '@/features/dns/diagnostics/rate-limit'

const NOW = 1_800_000_000_000

describe('rate limit', () => {
  it('reads the RateLimit headers', () => {
    const headers = new Headers({
      'RateLimit-Limit': '10',
      'RateLimit-Remaining': '3',
      'RateLimit-Reset': '42',
    })
    expect(rateLimitFromHeaders(headers, NOW)).toEqual({
      limit: 10,
      remaining: 3,
      resetAt: NOW + 42_000,
    })
    expect(rateLimitFromHeaders(new Headers(), NOW)).toBeNull()
    expect(rateLimitFromHeaders(new Headers({ 'RateLimit-Remaining': 'x' }), NOW)).toBeNull()
  })

  it('uses the retryAfter of a 429', () => {
    const problem = ApiProblem.fromParts({
      kind: 'problem',
      status: 429,
      type: '/api/v2/problems/too-many-requests',
      retryAfter: 30,
    })
    expect(rateLimitFromProblem(problem, 10, NOW)).toEqual({
      limit: 10,
      remaining: 0,
      resetAt: NOW + 30_000,
    })
    expect(rateLimitFromProblem(ApiProblem.fromParts({ kind: 'network' }), 10, NOW)).toBeNull()
  })

  it('shows the remaining runs from three down, within the window', () => {
    expect(showRemaining({ limit: 10, remaining: 3, resetAt: NOW + 1000 }, NOW)).toBe(true)
    expect(showRemaining({ limit: 10, remaining: 4, resetAt: NOW + 1000 }, NOW)).toBe(false)
    expect(showRemaining({ limit: 10, remaining: 1, resetAt: NOW - 1 }, NOW)).toBe(false)
    expect(showRemaining(undefined, NOW)).toBe(false)
  })

  it('blocks a run until the reset when none is left', () => {
    expect(blockedUntil({ limit: 10, remaining: 0, resetAt: NOW + 5000 }, NOW)).toBe(NOW + 5000)
    expect(blockedUntil({ limit: 10, remaining: 0, resetAt: NOW - 1 }, NOW)).toBeNull()
    expect(blockedUntil({ limit: 10, remaining: 2, resetAt: NOW + 5000 }, NOW)).toBeNull()
    expect(blockedUntil(undefined, NOW)).toBeNull()
  })
})
