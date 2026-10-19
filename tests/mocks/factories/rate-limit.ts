// UI 006 (T025, T097): rate limits as `RateLimit`. The value is stored on the domain, alias domain
// or mailbox (`rateLimit`), where UI 002-004 read it too; a stored text in another format is kept in
// `invalidRateLimits` by `<kind>:<object>` and reported as `invalidStoredValue`.
import { createHash } from 'node:crypto'

import type { RateLimit, RateLimitValue } from '@/api'

export type RateLimitKind = RateLimit['kind']

export const rateLimitKey = (kind: RateLimitKind, object: string) =>
  `${kind}:${object.toLowerCase()}`

/** The stored text as mailcow writes it: `<value> / 1<s|m|h|d>`. */
export function storedText(limit: RateLimitValue | null): string | null {
  return limit ? `${limit.value} / 1${limit.frame[0]}` : null
}

export function rateLimitEtag(kind: RateLimitKind, object: string, stored: string | null): string {
  const key = JSON.stringify([kind, object.toLowerCase(), stored])
  return `"r${createHash('sha256').update(key).digest('hex').slice(0, 23)}"`
}

export function rateLimitView(
  kind: RateLimitKind,
  object: string,
  limit: RateLimitValue | null,
  invalid: string | null,
  effective?: { limit: RateLimitValue | null; source: 'mailbox' | 'domain' | 'none' },
): RateLimit {
  const stored = invalid ?? storedText(limit)
  return {
    object: object.toLowerCase(),
    kind,
    limit: invalid ? null : limit ? { ...limit } : null,
    invalidStoredValue: invalid,
    ...(kind === 'mailbox' && effective
      ? {
          effectiveLimit: effective.limit ? { ...effective.limit } : null,
          effectiveSource: effective.source,
        }
      : {}),
    etag: rateLimitEtag(kind, object, stored),
  }
}
