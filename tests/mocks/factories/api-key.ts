// API key factory: contract-valid `ApiKey` and `ApiKeyCreated` objects.
import type { ApiKey, ApiKeyCreated } from '@/api'

import { token, ulid } from './ids'

let counter = 0

export function apiKey(overrides: Partial<ApiKey> = {}): ApiKey {
  counter += 1
  const createdAt = new Date(Date.UTC(2026, 9, 1, 8, 0) + counter * 3_600_000).toISOString()
  return {
    id: ulid(),
    name: `Key ${counter}`,
    prefix: `mcv2_${token(6)}`,
    owner: { username: 'admin', role: 'admin', active: true },
    accessLevel: 'readOnly',
    allowedNetworks: [],
    expiresAt: null,
    status: 'active',
    createdAt,
    createdBy: { username: 'admin' },
    lastUsedAt: null,
    lastUsedFrom: null,
    revokedAt: null,
    revokedBy: null,
    etag: `"ak-${counter}"`,
    ...overrides,
  }
}

/** A newly created key with its one-time secret (`^mcv2_[A-Za-z0-9]{40}$`). */
export function apiKeyCreated(overrides: Partial<ApiKey> = {}): ApiKeyCreated {
  const secret = `mcv2_${token(40)}`
  return { ...apiKey({ prefix: secret.slice(0, 11), ...overrides }), secret }
}
