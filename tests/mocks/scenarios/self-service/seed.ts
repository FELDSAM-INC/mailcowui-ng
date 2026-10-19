// Seed data shared by UI 005's scenario modules (T013, research R24): anna@example.org, the
// mailbox user of the spec's examples, with her mailbox, second factors, app passwords, aliases
// and recent logins; reseller and admin reach her in the mailbox context.
import type { PermissionFlags } from '@/api'

import { mockAppPassword } from '../../factories/app-password'
import { GIB, MIB } from '../../factories/domain'
import { recentLogin } from '../../factories/recent-login'
import { mailboxAccount, permissionFlags, securityKey, totp } from '../accounts'
import type { ScenarioState } from '../state'
import { accountSelfService, ensureMailbox, mailboxSelfService } from './state'

export const ANNA = 'anna@example.org'

/** The user flags of FR-002, all on or all off. */
export function userFlags(value: boolean): Partial<PermissionFlags> {
  return {
    spamAlias: value,
    tlsPolicy: value,
    delimiterAction: value,
    easReset: value,
    sogoProfileReset: value,
    pushover: value,
    appPasswds: value,
    pwReset: value,
    spamScore: true,
    spamPolicy: true,
    syncjobs: true,
  }
}

/** anna's mailbox and account, with every user flag on unless `flags` says otherwise. */
export function seedAnna(
  state: ScenarioState,
  options: { flags?: Partial<PermissionFlags>; withData?: boolean } = {},
): void {
  const flags = { ...userFlags(true), ...options.flags }
  ensureMailbox(state, ANNA, {
    displayName: 'Anna Novak',
    quota: GIB,
    quotaUsed: 256 * MIB,
    messageCount: 1234,
    recoveryEmail: 'anna.private@example.net',
    webmailRedirect: false,
    userPermissions: {
      spamAlias: !!flags.spamAlias,
      tlsPolicy: !!flags.tlsPolicy,
      spamScore: true,
      spamPolicy: true,
      delimiterAction: !!flags.delimiterAction,
      syncjobs: true,
      easReset: !!flags.easReset,
      sogoProfileReset: !!flags.sogoProfileReset,
      pushover: !!flags.pushover,
      quarantine: true,
      quarantineAttachments: true,
      quarantineNotification: true,
      quarantineCategory: true,
      appPasswds: !!flags.appPasswds,
      pwReset: !!flags.pwReset,
    },
  })
  ensureMailbox(state, 'alice@example.org', { displayName: 'Alice' })
  ensureMailbox(state, 'bob@example.org', { displayName: 'Bob' })
  if (!state.accounts.some((account) => account.username === ANNA)) {
    state.accounts.push(
      mailboxAccount({
        username: ANNA,
        permissions: permissionFlags(false, flags),
        secondFactors: [totp(21, 'Phone'), securityKey(22, 'YubiKey 5C')],
      }),
    )
  }
  if (options.withData === false) return
  const record = mailboxSelfService(state, ANNA)
  record.appPasswords = [
    mockAppPassword({ id: 1, name: 'Laptop', protocols: ['imap', 'smtp'] }),
    mockAppPassword({
      id: 2,
      name: 'Phone',
      protocols: ['imap', 'smtp', 'activeSync', 'dav'],
      createdAt: '2026-09-10T08:00:00.000Z',
    }),
    mockAppPassword({
      id: 3,
      name: 'Tablet',
      protocols: ['imap', 'pop3', 'smtp', 'sieve', 'activeSync', 'dav'],
      createdAt: '2026-09-20T08:00:00.000Z',
    }),
  ]
  record.directAliases = [{ address: 'a.novak@example.org', publicComment: null }]
  record.sharedAliases = [{ address: 'sales@example.org', publicComment: 'Sales team' }]
  record.aliasDomainAddresses = [{ address: 'anna@example.com', aliasDomain: 'example.com' }]
  record.sendAs = { addresses: ['info@example.org'], domains: [], anyAddress: false }
  record.catchAllAddresses = []
  record.temporaryAliasDomains = ['example.com']
  const now = state.now()
  const iso = (hoursAgo: number) => new Date(now - hoursAgo * 3_600_000).toISOString()
  record.recentLogins = [
    recentLogin({
      service: 'IMAP',
      clientAddress: '198.51.100.7',
      country: 'DE',
      lastSeenAt: iso(1),
    }),
    recentLogin({
      service: 'SMTP',
      clientAddress: '203.0.113.9',
      country: 'CZ',
      appPassword: { id: 2, name: 'Phone' },
      lastSeenAt: iso(5),
    }),
    recentLogin({
      service: 'WEBUI',
      clientAddress: '192.168.1.20',
      internal: true,
      country: null,
      lastSeenAt: iso(26),
    }),
  ]
  accountSelfService(state, ANNA).signInFactorId = 21
}

export { GIB, MIB }
