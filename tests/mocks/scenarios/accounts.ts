// Accounts of the mock scenarios. Usernames follow the API's DevelopmentSeeder (research R25), so
// scenarios and smoke tests speak about the same people.
import type { PermissionFlags, Role } from '@/api'

import type { MockAccount, MockSecondFactor } from './state'

export const MOCK_PASSWORD = 'Passw0rd!mock'

const PERMISSION_NAMES = [
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
  'loginAs',
  'sogoAccess',
  'bccMaps',
  'filters',
  'ratelimit',
  'extendSenderAcl',
  'unlimitedQuota',
  'protocolAccess',
  'smtpIpAccess',
  'aliasDomains',
  'mailboxRelayhost',
  'domainRelayhost',
  'domainDesc',
  'aliasExternalGoto',
] as const satisfies readonly (keyof PermissionFlags)[]

/** Every permission flag set to `value`, with overrides. */
export function permissionFlags(
  value: boolean,
  overrides: Partial<PermissionFlags> = {},
): PermissionFlags {
  const flags = Object.fromEntries(PERMISSION_NAMES.map((name) => [name, value])) as PermissionFlags
  return { ...flags, ...overrides }
}

function base(username: string, role: Role): MockAccount {
  return {
    username,
    password: MOCK_PASSWORD,
    role,
    active: true,
    external: false,
    secondFactors: [],
    secondFactorsUnavailable: false,
    passkeys: [],
    permissions: permissionFlags(role === 'admin'),
    scope: { type: 'allDomains' },
    pendingActions: [],
    preferences: { language: 'en-gb', theme: 'system', etag: '"pref-1"' },
  }
}

export function adminAccount(overrides: Partial<MockAccount> = {}): MockAccount {
  return { ...base('admin', 'admin'), ...overrides }
}

export function domainAdminAccount(overrides: Partial<MockAccount> = {}): MockAccount {
  return {
    ...base('reseller', 'domainAdmin'),
    scope: { type: 'domains', domains: ['example.org', 'example.net'] },
    permissions: permissionFlags(true, { syncjobs: true, bccMaps: false, loginAs: false }),
    ...overrides,
  }
}

export function mailboxAccount(overrides: Partial<MockAccount> = {}): MockAccount {
  const username = overrides.username ?? 'alice@example.org'
  const domain = username.split('@')[1] ?? 'example.org'
  return {
    ...base(username, 'mailboxUser'),
    scope: { type: 'mailbox', mailbox: username, domain },
    permissions: permissionFlags(false, { spamScore: true, spamPolicy: true, syncjobs: true }),
    ...overrides,
  }
}

export function totp(id: number, name: string, secret = '123456'): MockSecondFactor {
  return { id, type: 'totp', name, tier: 'primary', secret }
}

export function securityKey(id: number, name: string): MockSecondFactor {
  return { id, type: 'webauthn', name, tier: 'primary', secret: '' }
}

export function yubiOtp(id: number, name: string): MockSecondFactor {
  return {
    id,
    type: 'yubiOtp',
    name,
    tier: 'advanced',
    secret: 'cccccbcgujhingjrdejhgfnuetrgigvejhhgbkugdedf',
  }
}

/** admin, reseller (domain admin of two domains), alice (TOTP) and bob (forced password change). */
export function standardAccounts(): MockAccount[] {
  return [
    adminAccount(),
    domainAdminAccount(),
    mailboxAccount({ secondFactors: [totp(11, 'Phone')] }),
    mailboxAccount({ username: 'bob@example.org', pendingActions: ['passwordChange'] }),
  ]
}
