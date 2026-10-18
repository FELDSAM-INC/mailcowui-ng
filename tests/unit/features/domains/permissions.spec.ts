// The permission matrix of FR-002 (UI 002 T022, research D24, SC-005).
import { describe, expect, it } from 'vitest'

import type { Identity } from '@/api'
import { domainPermissions } from '@/features/domains/permissions'

function identity(role: Identity['role'], domainDesc: boolean): Identity {
  return {
    username: role,
    role,
    authentication: { method: 'password' },
    scope: role === 'admin' ? { type: 'allDomains' } : { type: 'domains', domains: ['a.example'] },
    permissions: { domainDesc } as Identity['permissions'],
    pendingActions: [],
    preferences: { language: 'en-gb', theme: 'system', etag: '"1"' },
  }
}

const ALL = [
  'description',
  'active',
  'maxMailboxes',
  'maxAliases',
  'maxMailboxQuota',
  'domainQuota',
  'backupMx',
  'relayAllRecipients',
  'relayUnknownOnly',
  'globalAddressList',
  'tags',
]

describe('domainPermissions', () => {
  it.each([
    ['admin', identity('admin', false), true, ALL],
    [
      'domain admin with domainDesc',
      identity('domainAdmin', true),
      false,
      ['description', 'globalAddressList', 'tags'],
    ],
    [
      'domain admin without domainDesc',
      identity('domainAdmin', false),
      false,
      ['globalAddressList', 'tags'],
    ],
  ] as const)('%s', (_name, who, admin, editable) => {
    const permissions = domainPermissions(who)
    expect(permissions.canCreate).toBe(admin)
    expect(permissions.canDelete).toBe(admin)
    expect(permissions.canBulk).toBe(admin)
    expect(permissions.canManageTemplates).toBe(admin)
    expect(permissions.canSeeDomainAdmins).toBe(admin)
    expect([...permissions.editable].sort()).toEqual([...editable].sort())
  })

  it('grants nothing without an identity or to a mailbox user', () => {
    for (const who of [null, identity('mailboxUser', true)]) {
      const permissions = domainPermissions(who)
      expect(permissions.canCreate).toBe(false)
      expect(permissions.editable.size).toBe(0)
    }
  })
})
