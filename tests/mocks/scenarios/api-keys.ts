// Scenarios of US7 (T123): API keys of every status and access level, owners that are inactive or
// deleted, long names and network lists, enough keys and owner candidates to page through, and a
// key that another administrator revokes. Data is deterministic, so tests can name keys.
import type { ApiKey, ApiKeyAccessLevel } from '@/api'

import type { ScenarioDefinition } from './index'
import type { MockAccount } from './state'

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** A fixed ULID-shaped identifier for key number `n`. */
export function fixedKeyId(n: number): string {
  let digits = ''
  let value = n
  do {
    digits = CROCKFORD[value % 32]! + digits
    value = Math.floor(value / 32)
  } while (value > 0)
  return `01J9AK${digits.padStart(20, '0')}`
}

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function fixedPrefix(n: number): string {
  let out = ''
  let value = n * 7919 + 104729
  for (let i = 0; i < 7; i++) {
    out += ALNUM[value % ALNUM.length]
    value = Math.floor(value / ALNUM.length) + n + i * 31
  }
  return `mcv2_${out}`
}

const hours = (n: number) => n * 3_600_000
const BASE = Date.UTC(2026, 8, 1, 8, 0)
const iso = (time: number) => new Date(time).toISOString()

/** A contract-valid key of the scenarios. */
export function scenarioKey(n: number, overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: fixedKeyId(n),
    name: `Billing ${String(n).padStart(2, '0')}`,
    prefix: fixedPrefix(n),
    owner: { username: 'admin', role: 'admin', active: true },
    accessLevel: 'readOnly',
    allowedNetworks: [],
    expiresAt: null,
    status: 'active',
    createdAt: iso(BASE + hours(n)),
    createdBy: { username: 'admin' },
    lastUsedAt: null,
    lastUsedFrom: null,
    revokedAt: null,
    revokedBy: null,
    etag: `"ak-${n}"`,
    ...overrides,
  }
}

/** 255 characters without spaces, to check wrapping. */
export const LONG_KEY_NAME = `Reporting-${'x'.repeat(233)}-integration`

/** Sixty keys: every status and access level, unusable owners, long names and networks. */
export function manyKeys(): ApiKey[] {
  const keys: ApiKey[] = []
  for (let n = 1; n <= 60; n++) {
    const accessLevel: ApiKeyAccessLevel = n % 3 === 0 ? 'readWrite' : 'readOnly'
    const key = scenarioKey(n, { accessLevel })
    if (n % 5 === 0) {
      key.revokedAt = iso(BASE + hours(n + 2))
      key.revokedBy = { username: 'admin' }
      key.status = 'revoked'
    } else if (n % 7 === 0) {
      key.expiresAt = iso(Date.UTC(2026, 0, 1))
      key.status = 'expired'
    } else if (n % 2 === 0) {
      key.expiresAt = iso(Date.UTC(2030, 0, 1))
    }
    if (n % 4 === 0) {
      key.lastUsedAt = iso(BASE + hours(n + 1))
      key.lastUsedFrom = '198.51.100.7'
    }
    if (n % 6 === 0) key.owner = { username: 'reseller', role: 'domainAdmin', active: true }
    keys.push(key)
  }
  keys[10] = { ...keys[10]!, owner: { username: 'former', role: 'domainAdmin', active: false } }
  keys[11] = { ...keys[11]!, owner: { username: 'olduser', role: null, active: false } }
  keys[12] = {
    ...keys[12]!,
    name: LONG_KEY_NAME,
    allowedNetworks: Array.from({ length: 12 }, (_, i) => `2001:db8:${(i + 1).toString(16)}::/48`),
  }
  return keys
}

/** Thirty extra domain administrators, so the owner picker has more than one page. */
function manyOwners(): Record<string, Partial<MockAccount>> {
  return Object.fromEntries(
    Array.from({ length: 30 }, (_, i) => [
      `reseller${String(i + 1).padStart(2, '0')}`,
      { role: 'domainAdmin' as const },
    ]),
  )
}

/** The key that another administrator revokes in `api-key-revoked-elsewhere`. */
export const ELSEWHERE_KEY = scenarioKey(90, {
  name: 'Monitoring',
  allowedNetworks: ['192.0.2.0/24', '2001:db8::/32'],
  expiresAt: iso(Date.UTC(2030, 0, 1)),
  lastUsedAt: iso(BASE + hours(100)),
  lastUsedFrom: '192.0.2.44',
})

export const apiKeyScenarios: Record<string, ScenarioDefinition> = {
  'api-keys-empty': {
    description: 'admin is signed in and there are no API keys.',
    overrides: { signedInAs: 'admin', apiKeys: [] },
  },
  'api-keys-many': {
    description:
      'admin is signed in; 60 keys of every status and access level, owners inactive (former) or deleted (olduser), a 255-character name, many networks, and 30 extra domain administrators.',
    overrides: {
      signedInAs: 'admin',
      apiKeys: manyKeys(),
      accounts: { former: { role: 'domainAdmin', active: false }, ...manyOwners() },
    },
  },
  'api-key-owner-deactivated': {
    description:
      'admin is signed in; keys of the deactivated domain administrator former and of the deleted olduser.',
    overrides: {
      signedInAs: 'admin',
      accounts: { former: { role: 'domainAdmin', active: false } },
      apiKeys: [
        scenarioKey(1, { owner: { username: 'former', role: 'domainAdmin', active: false } }),
        scenarioKey(2, { owner: { username: 'olduser', role: null, active: false } }),
        scenarioKey(3),
      ],
    },
  },
  'api-key-revoked-elsewhere': {
    description:
      'admin is signed in with one active key (Monitoring); tests revoke it on the server meanwhile.',
    overrides: { signedInAs: 'admin', apiKeys: [ELSEWHERE_KEY] },
  },
}
