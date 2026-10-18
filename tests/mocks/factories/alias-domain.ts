// Alias domain factory (UI 004 research R21): UI 002 stores only the name and the target, so the
// other members have defaults. The version tag covers the name, the target and the active state
// (API data-model "Version tags"), never the alias count, relay state or rate limit.
import { createHash } from 'node:crypto'

import type { MockAliasDomain } from '../scenarios/state'
import { asciiName } from './domain'

export const ALIAS_DOMAIN_CREATED_AT = '2026-01-10T09:00:00.000Z'

/** A stored alias domain with its defaults filled in. */
export function mockAliasDomain(
  overrides: Partial<MockAliasDomain> & { name: string; target: string },
): Required<MockAliasDomain> {
  return {
    active: true,
    rateLimit: null,
    createdAt: ALIAS_DOMAIN_CREATED_AT,
    modifiedAt: null,
    ...overrides,
    name: asciiName(overrides.name) || overrides.name,
    target: asciiName(overrides.target) || overrides.target,
  }
}

/** The stored values of an alias domain with its defaults. */
export function aliasDomainValues(item: MockAliasDomain): Required<MockAliasDomain> {
  return mockAliasDomain(item)
}

export function aliasDomainEtag(item: MockAliasDomain): string {
  const values = aliasDomainValues(item)
  const stored = [values.name, values.target, values.active]
  return `"${createHash('sha256').update(JSON.stringify(stored)).digest('hex').slice(0, 24)}"`
}
