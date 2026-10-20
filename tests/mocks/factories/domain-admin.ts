import {
  domainAdminPermissionNameValues,
  type AccountCapabilities,
  type DomainAdmin,
  type DomainAdminAssignment,
  type DomainAdminPermissions,
} from '@/api'
import { mockAdmin, accountEtag } from './admin'
import { readableName } from './domain'

export interface MockDomainAdmin extends Omit<DomainAdmin, 'etag' | 'permissions'> {
  version: number
  permissions: DomainAdminPermissions | null
}
export function permissionDefaults(value = true): DomainAdminPermissions {
  return Object.fromEntries(
    domainAdminPermissionNameValues.map((name) => [name, value]),
  ) as DomainAdminPermissions
}
export function accountCapabilities(): AccountCapabilities {
  return {
    bulkLimit: 100,
    usernameMaxLength: 255,
    ssoTokenLifetime: 30,
    pageSize: { default: 25, maximum: 1000 },
    newAccountDefaults: { active: true, forcePasswordChange: false, forceSecondFactorSetup: false },
    domainAdminPermissionDefaults: {
      ...permissionDefaults(),
      pushover: false,
      extendSenderAcl: false,
      unlimitedQuota: false,
      aliasDomains: false,
      domainDesc: false,
    },
  }
}
export function assignment(
  domain: string,
  overrides: Partial<DomainAdminAssignment> = {},
): DomainAdminAssignment {
  return {
    domain,
    domainUnicode: readableName(domain),
    active: true,
    domainExists: true,
    createdAt: '2026-01-01T09:00:00.000Z',
    ...overrides,
  }
}
export function mockDomainAdmin(overrides: Partial<MockDomainAdmin> = {}): MockDomainAdmin {
  return {
    ...mockAdmin({ username: 'reseller' }),
    domains: [assignment('example.org')],
    permissions: accountCapabilities().domainAdminPermissionDefaults,
    ...overrides,
  }
}
export function domainAdminView(item: MockDomainAdmin): DomainAdmin {
  const { version: _version, ...value } = item
  return {
    ...value,
    domains: [...value.domains].sort((a, b) => a.domain.localeCompare(b.domain)),
    permissions: value.permissions ?? permissionDefaults(false),
    etag: accountEtag(item),
  }
}
