// UI 006 US6 scenarios (T097, research R28): rate limits on domains, alias domains and mailboxes
// in UI 004's world (see `setupQuarantineWorld`), for every role, with and without the domain
// administrator's `ratelimit` flag, stored values in an invalid format, an empty and a long
// overview, and the bucket `RLabc=`. Runtime changes go through `{ quarantine: { rateLimits,
// invalidRateLimits, buckets } }` and the `failures` of an operation.
import { mockMailbox } from '../factories/mailbox'
import type { ScenarioDefinition } from './index'
import { ALICE, QUARANTINE_DOMAIN_ADMIN, setupQuarantineWorld } from './quarantine'
import type { ScenarioState } from './state'

/** The limits of `rate-limits-admin`: 3 domains, 1 alias domain and 4 mailboxes. */
export const RATE_LIMITS = {
  domain: {
    'example.org': { value: 100, frame: 'hour' },
    'example.com': { value: 50, frame: 'minute' },
    'other.example': { value: 1000, frame: 'day' },
  },
  aliasDomain: { 'example.net': { value: 20, frame: 'hour' } },
  mailbox: {
    'alice@example.org': { value: 10, frame: 'minute' },
    'bob@example.org': { value: 5, frame: 'second' },
    'erik@example.com': { value: 200, frame: 'day' },
    'gina@other.example': { value: 30, frame: 'hour' },
  },
} as const

/** The invalid stored values of `rate-limits-invalid-stored` (written by another tool). */
export const INVALID_RATE_LIMITS = {
  'domain:example.com': '100/hour',
  'mailbox:dave@example.org': 'lots / 1w',
} as const

function setLimits(state: ScenarioState): void {
  for (const domain of state.domains) {
    const limit = RATE_LIMITS.domain[domain.name as keyof typeof RATE_LIMITS.domain]
    domain.rateLimit = limit ? { ...limit } : null
  }
  for (const item of state.aliasDomains) {
    const limit = RATE_LIMITS.aliasDomain[item.name as keyof typeof RATE_LIMITS.aliasDomain]
    item.rateLimit = limit ? { ...limit } : null
  }
  for (const mailbox of state.mailboxes) {
    const address = `${mailbox.localPart}@${mailbox.domain}`
    const limit = RATE_LIMITS.mailbox[address as keyof typeof RATE_LIMITS.mailbox]
    mailbox.rateLimit = limit ? { ...limit } : null
  }
}

function world(state: ScenarioState, resellerFlags: { ratelimit: boolean } = { ratelimit: true }) {
  setupQuarantineWorld(state, { items: [], resellerFlags })
  setLimits(state)
}

export const rateLimitScenarios: Record<string, ScenarioDefinition> = {
  'rate-limits-admin': {
    description:
      'The administrator; rate limits on example.org (100 / hour), example.com (50 / minute), other.example (1000 / day), the alias domain example.net (20 / hour) and alice, bob, erik and gina (RATE_LIMITS); the bucket RLabc= (UI 006 US6).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => world(state),
  },
  'rate-limits-domain-admin': {
    description:
      'The domain administrator "reseller" of example.org and example.com with `ratelimit`, and the limits of rate-limits-admin (US6-AS1, US6-AS2).',
    overrides: { signedInAs: QUARANTINE_DOMAIN_ADMIN },
    setup: (state) => world(state),
  },
  'rate-limits-domain-admin-no-flag': {
    description:
      'The domain administrator "reseller" without `ratelimit`: limits are read-only (US6-AS7).',
    overrides: { signedInAs: QUARANTINE_DOMAIN_ADMIN },
    setup: (state) => world(state, { ratelimit: false }),
  },
  'rate-limits-invalid-stored': {
    description:
      'The administrator; example.com stores "100/hour" and dave@example.org "lots / 1w", which the API reports as invalid stored values (US6-AS5, FR-055).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => {
      world(state)
      state.quarantine.invalidRateLimits = { ...INVALID_RATE_LIMITS }
    },
  },
  'rate-limits-mailbox-user': {
    description:
      'alice@example.org, a mailbox user, to whom rate limits are not offered (US6-AS7).',
    overrides: { signedInAs: ALICE },
    setup: (state) => world(state),
  },
  'rate-limits-empty': {
    description: 'The administrator on a server without any rate limit (FR-056 empty state).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => {
      setupQuarantineWorld(state, { items: [] })
      for (const domain of state.domains) domain.rateLimit = null
    },
  },
  'rate-limits-many': {
    description:
      'The administrator with the limits of rate-limits-admin and 30 more mailboxes of example.org (limit01@ to limit30@, n / hour): 38 limits, two pages of 25 (FR-056 paging).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => {
      world(state)
      for (let index = 1; index <= 30; index += 1) {
        const localPart = `limit${String(index).padStart(2, '0')}`
        state.mailboxes.push(
          mockMailbox({
            localPart,
            domain: 'example.org',
            rateLimit: { value: index, frame: 'hour' },
          }),
        )
      }
    },
  },
}
