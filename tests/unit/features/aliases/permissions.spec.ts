// The permission matrix of spec FR-002 (T025, research R6, SC-007), table-driven for
// administrators, domain administrators with each flag on and off, and mailbox users.
import { describe, expect, it } from 'vitest'

import type { AliasCapabilities, Identity, PermissionFlags } from '@/api'
import { feature004Permissions } from '@/features/aliases-common'

function identity(role: Identity['role'], flags: Partial<PermissionFlags> = {}): Identity {
  return {
    username: role,
    role,
    authentication: { method: 'password' },
    scope:
      role === 'admin'
        ? { type: 'allDomains' }
        : role === 'domainAdmin'
          ? { type: 'domains', domains: ['example.org'] }
          : { type: 'mailbox', mailbox: 'anna@example.org', domain: 'example.org' },
    permissions: {
      aliasDomains: false,
      aliasExternalGoto: false,
      extendSenderAcl: false,
      ratelimit: false,
      ...flags,
    } as PermissionFlags,
    pendingActions: [],
    preferences: { language: 'en-gb', theme: 'system', etag: '"1"' },
  }
}

const caps = (externalDestinationsDisabled = false) =>
  ({ externalDestinationsDisabled }) as AliasCapabilities

type Row = keyof ReturnType<typeof feature004Permissions>

const ADMIN = identity('admin')
const DA = identity('domainAdmin')
const USER = identity('mailboxUser')

describe('feature004Permissions (FR-002)', () => {
  it.each<[Row, Identity, boolean]>([
    ['canView', ADMIN, true],
    ['canView', DA, true],
    ['canView', USER, false],
    ['canManageAliases', ADMIN, true],
    ['canManageAliases', DA, true],
    ['canManageAliases', USER, false],
    ['canAddAliasDomain', ADMIN, true],
    ['canAddAliasDomain', DA, false],
    ['canAddAliasDomain', identity('domainAdmin', { aliasDomains: true }), true],
    ['canAddAliasDomain', USER, false],
    ['canSetInitialRateLimit', ADMIN, true],
    ['canSetInitialRateLimit', DA, false],
    ['canSetInitialRateLimit', identity('domainAdmin', { ratelimit: true }), true],
    ['canManageAliasDomains', DA, true],
    ['canManageResources', DA, true],
    ['canManageResources', USER, false],
    ['canEditSendAs', DA, true],
    ['canEditSendAs', USER, false],
    ['canGrantAnyAddress', ADMIN, true],
    [
      'canGrantAnyAddress',
      identity('domainAdmin', { extendSenderAcl: true, aliasDomains: true }),
      false,
    ],
    ['canEditExternalSenderAddresses', ADMIN, true],
    ['canEditExternalSenderAddresses', DA, false],
    ['canEditExternalSenderAddresses', identity('domainAdmin', { extendSenderAcl: true }), true],
    ['canSeeHistory', ADMIN, true],
    ['canSeeHistory', DA, false],
    ['canSeeOrphaned', ADMIN, true],
    ['canSeeOrphaned', DA, false],
  ])('%s for %o is %s', (row, who, expected) => {
    expect(feature004Permissions(who, caps())[row]).toBe(expected)
  })

  it.each<[string, Identity, boolean, boolean]>([
    ['admin', ADMIN, false, false],
    ['admin, disabled for everyone', ADMIN, true, true],
    ['domain admin without aliasExternalGoto', DA, false, true],
    [
      'domain admin with aliasExternalGoto',
      identity('domainAdmin', { aliasExternalGoto: true }),
      false,
      false,
    ],
    [
      'domain admin with aliasExternalGoto, disabled for everyone',
      identity('domainAdmin', { aliasExternalGoto: true }),
      true,
      true,
    ],
  ])('externalDestinationsRestricted: %s', (_, who, disabled, expected) => {
    expect(feature004Permissions(who, caps(disabled)).externalDestinationsRestricted).toBe(expected)
  })

  it('denies everything without an identity', () => {
    const none = feature004Permissions(null, undefined)
    expect(Object.values(none).every((value) => value === false)).toBe(true)
  })
})
