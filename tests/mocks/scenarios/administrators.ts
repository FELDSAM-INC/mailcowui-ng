import type { ScenarioDefinition } from './index'
import type { ScenarioState, MockAccount, ChangesElsewhere } from './state'
import { adminAccount, domainAdminAccount, MOCK_PASSWORD, permissionFlags } from './accounts'
import { mockAdmin, type MockAdmin } from '../factories/admin'
import {
  mockDomainAdmin,
  assignment,
  accountCapabilities,
  permissionDefaults,
  type MockDomainAdmin,
} from '../factories/domain-admin'
import { mockDomain } from '../factories/domain'

/** Keep the mock identity and the account-management representation in the same state. */
export function syncManagedAccount(
  state: ScenarioState,
  item: MockAdmin | MockDomainAdmin,
  password?: string,
  previousUsername = item.username,
): void {
  const domainAdmin = 'domains' in item
  const old = state.accounts.find((account) => account.username === previousUsername)
  const base = old ?? (domainAdmin ? domainAdminAccount() : adminAccount())
  const account: MockAccount = {
    ...base,
    username: item.username,
    active: item.active,
    password: password ?? old?.password ?? MOCK_PASSWORD,
    pendingActions: [
      ...(item.forcePasswordChange ? ['passwordChange' as const] : []),
      ...(item.forceSecondFactorSetup && item.secondFactorStatus === 'none'
        ? ['secondFactorSetup' as const]
        : []),
    ],
    ...(domainAdmin
      ? {
          permissions: {
            ...permissionFlags(false),
            ...(item.permissions ?? permissionDefaults(false)),
          },
          scope: {
            type: 'domains' as const,
            domains: item.domains.filter((d) => d.active && d.domainExists).map((d) => d.domain),
          },
        }
      : {}),
  }
  if (old) state.accounts[state.accounts.indexOf(old)] = account
  else state.accounts.push(account)
  if (state.session.username === previousUsername) state.session.username = item.username
}
export function initialAdministratorState() {
  return {
    admins: [mockAdmin()],
    domainAdmins: [
      mockDomainAdmin({
        domains: [assignment('example.net'), assignment('example.org')],
        permissions: { ...accountCapabilities().domainAdminPermissionDefaults, loginAs: false },
      }),
    ],
    accountDefaults: accountCapabilities(),
    ssoTokens: [] as { token: string; username: string; issuedAt: number; used: boolean }[],
    allowAdminEmailLogin: true,
    groupwareEnabled: true,
    invalidateImpersonation: false,
  }
}
function three(state: ScenarioState): void {
  state.domainAdmins = [
    mockDomainAdmin({
      username: 'reseller',
      domains: [assignment('example.org')],
      permissions: { ...accountCapabilities().domainAdminPermissionDefaults, loginAs: false },
    }),
    mockDomainAdmin({
      username: 'team',
      domains: [assignment('example.org'), assignment('example.net')],
      secondFactorStatus: 'active',
      activePasskeyCount: 2,
    }),
    mockDomainAdmin({ username: 'third', domains: [assignment('example.net')], active: false }),
  ]
  for (const item of state.domainAdmins) syncManagedAccount(state, item)
}
const base = (setup: (state: ScenarioState) => void): ScenarioDefinition => ({
  description: 'Administrator account management',
  overrides: { signedInAs: 'admin' },
  setup: (state) => {
    state.domains = [mockDomain({ name: 'example.org' }), mockDomain({ name: 'example.net' })]
    setup(state)
  },
})
export const administratorScenarios: Record<string, ScenarioDefinition> = {
  'domain-admins-three': base(three),
  'domain-admins-empty': base((state) => {
    state.domainAdmins = []
  }),
  'domain-admins-many': base((state) => {
    state.domains = Array.from({ length: 3000 }, (_, i) =>
      mockDomain({ name: `domain-${String(i).padStart(4, '0')}.example` }),
    )
    state.domainAdmins = Array.from({ length: 120 }, (_, i) =>
      mockDomainAdmin({
        username: `reseller-${String(i).padStart(3, '0')}`,
        domains: state.domains.slice(i, i + (i === 0 ? 40 : 2)).map((d) => assignment(d.name)),
      }),
    )
  }),
  'domain-admins-edge': base((state) => {
    state.domainAdmins = [
      mockDomainAdmin({ username: 'without-domains', domains: [] }),
      mockDomainAdmin({
        username: 'all-assignment',
        domains: [assignment('ALL', { domainExists: false })],
      }),
      mockDomainAdmin({
        username: 'inactive-assignment',
        domains: [assignment('example.org', { active: false })],
      }),
      mockDomainAdmin({ username: 'without-acl', permissions: null }),
      mockDomainAdmin({ username: 'a'.repeat(255) }),
    ]
    for (const item of state.domainAdmins) syncManagedAccount(state, item)
  }),
  'domain-admins-as-domain-admin': {
    description: 'Domain administrator cannot manage administrator accounts',
    overrides: { signedInAs: 'reseller' },
    setup: three,
  },
  'domain-admins-list-error': {
    ...base(three),
    overrides: { signedInAs: 'admin', failures: { listDomainAdmins: { status: 500 } } },
  },
  'domain-admin-detail-error': {
    ...base(three),
    overrides: { signedInAs: 'admin', failures: { getDomainAdmin: { status: 500 } } },
  },
  'capabilities-unavailable': {
    ...base(three),
    overrides: { signedInAs: 'admin', failures: { getAccountCapabilities: { status: 500 } } },
  },
  'capabilities-bulk-limit-2': base((state) => {
    three(state)
    state.accountDefaults.bulkLimit = 2
  }),
  'admins-one': base((state) => {
    state.admins = [mockAdmin()]
  }),
  'admins-three': base((state) => {
    state.admins = [
      mockAdmin(),
      mockAdmin({ username: 'operator' }),
      mockAdmin({ username: 'inactive', active: false }),
    ]
    for (const item of state.admins) syncManagedAccount(state, item)
  }),
  'admins-empty': base((state) => {
    state.admins = []
  }),
}

/** A classic-interface edit used to exercise the real If-Match conflict path. */
export function applyAdministratorChanges(state: ScenarioState, changes: ChangesElsewhere): void {
  for (const [username, patch] of Object.entries(changes.admin ?? {})) {
    const item = state.admins.find((account) => account.username === username)
    if (!item) continue
    Object.assign(item, patch, { version: item.version + 1 })
    syncManagedAccount(state, item)
  }
  for (const [username, patch] of Object.entries(changes.domainAdmin ?? {})) {
    const item = state.domainAdmins.find((account) => account.username === username)
    if (!item) continue
    const permissions = patch.permissions
      ? { ...item.permissions, ...patch.permissions }
      : item.permissions
    Object.assign(item, patch, { permissions, version: item.version + 1 })
    syncManagedAccount(state, item)
  }
}
