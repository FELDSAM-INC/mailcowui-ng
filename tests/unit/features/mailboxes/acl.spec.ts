// Domain administrator gating (UI 003 T023, research R11, FR-041, FR-042, SC-010), table-driven
// over every combination of the four flags.
import { describe, expect, it } from 'vitest'

import type { Identity, PermissionFlags } from '@/api'

import {
  canBulkProtocols,
  canSeeRelayhost,
  canSetUnlimited,
  FLAG_LABEL_KEYS,
  gate,
  PERMISSION_LABEL_KEYS,
  PERMISSION_ORDER,
  presentPermissions,
} from '@/features/mailboxes/acl'

type Flag = 'protocolAccess' | 'sogoAccess' | 'ratelimit' | 'unlimitedQuota'
const FLAGS: Flag[] = ['protocolAccess', 'sogoAccess', 'ratelimit', 'unlimitedQuota']

function identity(role: Identity['role'], granted: Flag[] = []): Identity {
  const permissions = Object.fromEntries(
    [...FLAGS, 'mailboxRelayhost'].map((flag) => [
      flag,
      role === 'admin' || granted.includes(flag as Flag),
    ]),
  ) as unknown as PermissionFlags
  return {
    username: 'x',
    role,
    authentication: { method: 'password' },
    scope: role === 'admin' ? { type: 'allDomains' } : { type: 'domains', domains: ['a.example'] },
    permissions,
    pendingActions: [],
  }
}

const sets = Array.from({ length: 16 }, (_, mask) => FLAGS.filter((_, bit) => mask & (1 << bit)))

describe('administrators', () => {
  it('edit every gated field and may set an unlimited quota', () => {
    const admin = identity('admin')
    for (const field of ['protocolAccess', 'webmailRedirect', 'rateLimit'] as const) {
      expect(gate(field, admin)).toEqual({ state: 'editable' })
    }
    expect(canSetUnlimited(admin, 5)).toBe(true)
    expect(canBulkProtocols(admin)).toBe(true)
    expect(canSeeRelayhost(admin)).toBe(true)
  })
})

describe.each(sets.map((set) => [set.join('+') || 'no flags', set] as const))(
  'domain administrator with %s',
  (_label, granted) => {
    const who = identity('domainAdmin', granted)
    it('gates each field by its flag', () => {
      const expect_ = (field: 'protocolAccess' | 'webmailRedirect' | 'rateLimit', flag: Flag) =>
        expect(gate(field, who)).toEqual(
          granted.includes(flag) ? { state: 'editable' } : { state: 'readOnly', flag },
        )
      expect_('protocolAccess', 'protocolAccess')
      expect_('webmailRedirect', 'sogoAccess')
      expect_('rateLimit', 'ratelimit')
    })
    it('offers an unlimited quota only with the flag, or when the mailbox already has one', () => {
      expect(canSetUnlimited(who, 1024)).toBe(granted.includes('unlimitedQuota'))
      expect(canSetUnlimited(who, 0)).toBe(true)
      expect(canBulkProtocols(who)).toBe(granted.includes('protocolAccess'))
    })
  },
)

describe('labels and permissions', () => {
  it('names each flag with its legacy acl key', () => {
    expect(FLAG_LABEL_KEYS).toMatchObject({
      protocolAccess: 'acl.protocol_access',
      sogoAccess: 'acl.sogo_access',
      ratelimit: 'acl.ratelimit',
      unlimitedQuota: 'acl.unlimited_quota',
      syncjobs: 'acl.syncjobs',
    })
  })

  it('lists the present user permissions in legacy order, with the acl labels', () => {
    expect(PERMISSION_ORDER).toEqual([
      'spamAlias',
      'tlsPolicy',
      'spamScore',
      'spamPolicy',
      'delimiterAction',
      'syncjobs',
      'easReset',
      'sogoProfileReset',
      'pushover',
      'quarantine',
      'quarantineAttachments',
      'quarantineNotification',
      'quarantineCategory',
      'appPasswds',
      'pwReset',
    ])
    expect(PERMISSION_LABEL_KEYS.pwReset).toBe('acl.pw_reset')
    expect(PERMISSION_LABEL_KEYS.appPasswds).toBe('acl.app_passwds')
    expect(presentPermissions({ pwReset: true, spamAlias: false })).toEqual([
      'spamAlias',
      'pwReset',
    ])
  })

  it('shows the relayhost to domain administrators with mailboxRelayhost only', () => {
    expect(canSeeRelayhost(identity('domainAdmin'))).toBe(false)
  })
})
