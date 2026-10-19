// Where a rate limit is set (legacy form map D9): the page of its domain, alias domain or mailbox
// (UI 002–004), at the rate limit section (`#rate-limit`).
import type { RouteLocationRaw } from 'vue-router'

import type { RateLimitKind } from './api'

export const RATE_LIMIT_HASH = '#rate-limit'

export function hostLocation(kind: RateLimitKind, object: string): RouteLocationRaw {
  switch (kind) {
    case 'domain':
      return { name: 'domain-detail', params: { domain: object }, hash: RATE_LIMIT_HASH }
    case 'aliasDomain':
      return {
        name: 'alias-domain-detail',
        params: { aliasDomain: object },
        hash: RATE_LIMIT_HASH,
      }
    case 'mailbox':
      return { name: 'mailbox-detail', params: { address: object }, hash: RATE_LIMIT_HASH }
  }
}
