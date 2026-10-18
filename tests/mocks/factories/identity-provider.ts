// Identity provider data of the mock API (UI 012 T010, research R24): the capabilities with the
// API's documented defaults and limits, stored configurations of each type, the representation the
// API derives from them (completeness, missing settings, counts, version tag), synchronisation
// states and connection test results. Every object is built from the generated types.
import { createHash } from 'node:crypto'

import type {
  IdentityProvider,
  IdentityProviderCapabilities,
  IdentityProviderConnectionTestResult,
  IdentityProviderGenericOidc,
  IdentityProviderKeycloak,
  IdentityProviderLdap,
  IdentityProviderMailboxCounts,
  IdentityProviderMappingEntryInput,
  IdentityProviderSynchronisation,
  IdentityProviderType,
} from '@/api'

/** Members the API derives on every read; everything else is a stored setting. */
type Derived =
  | 'complete'
  | 'missingSettings'
  | 'mailboxCounts'
  | 'modifiedAt'
  | 'etag'
  | 'defaultTemplateExists'
  | 'appReturnUrls'
  | 'clientSecretSet'
  | 'bindPasswordSet'
  | 'synchronisation'
  | 'effectivePort'
  | 'attributeMapping'

type Stored<T> = Omit<T, Derived> & { attributeMapping: IdentityProviderMappingEntryInput[] }

export type StoredKeycloak = Stored<IdentityProviderKeycloak>
export type StoredGenericOidc = Stored<IdentityProviderGenericOidc>
export type StoredLdap = Stored<IdentityProviderLdap>
export type StoredIdentityProvider = StoredKeycloak | StoredGenericOidc | StoredLdap

/** What a connection test of the mock answers (research R24). */
export interface MockConnectionTest {
  outcome:
    | 'success'
    | 'unreachable'
    | 'timedOut'
    | 'tlsCertificateRejected'
    | 'credentialsRejected'
    | 'unexpectedResponse'
  /** Outcomes of the next tests in order; `outcome` applies once it is used up. */
  sequence?: MockConnectionTest['outcome'][]
  providerStatus?: number | null
  /** The test never answers (MSW `delay('infinite')`), for the 90-second client limit. */
  hang?: boolean
}

/** The identity provider state of a scenario. */
export interface MockIdentityProvider {
  /** The stored settings, or null when no configuration is stored. */
  stored: StoredIdentityProvider | null
  /** Server-side only, never returned. */
  clientSecret: string | null
  bindPassword: string | null
  /** Changes with every stored change; the version tag is derived from it. */
  version: number
  modifiedAt: string | null
  mailboxCounts: IdentityProviderMailboxCounts
  synchronisation: IdentityProviderSynchronisation
  /** The server's host names' return addresses of the new app. */
  appReturnUrls: string[]
  connectionTest: MockConnectionTest
  /** The next write answers 412, as if another administrator had saved first. */
  rotateEtagOnNextWrite: boolean
  /** The next change or removal finds no configuration (removed elsewhere). */
  removedElsewhere: boolean
  capabilities: Partial<Omit<IdentityProviderCapabilities, 'defaults' | 'limits'>> & {
    defaults?: Partial<IdentityProviderCapabilities['defaults']>
    limits?: Partial<IdentityProviderCapabilities['limits']>
  }
}

export const DEFAULT_APP_RETURN_URLS = [
  'https://mail.example.org/ng/sso/return',
  'https://webmail.example.org/ng/sso/return',
]

export const IDP_DEFAULTS: IdentityProviderCapabilities['defaults'] = {
  createMailboxOnSignIn: true,
  ignoreTlsErrors: false,
  scopes: 'openid profile email mailcow_template',
  port: 389,
  useSsl: false,
  useStartTls: false,
  usernameField: 'mail',
  mailpasswordFlow: false,
  importUsers: false,
  periodicSync: false,
  syncInterval: 15,
}

export const IDP_LIMITS: IdentityProviderCapabilities['limits'] = {
  attributeMappingMaxEntries: 100,
  attributeValueMaxLength: 255,
  additionalReturnUrlsMaxEntries: 100,
  urlMaxLength: 2000,
  ldapHostsMaxEntries: 10,
  syncIntervalMinMinutes: 1,
  syncIntervalMaxMinutes: 10080,
  secretMaxLength: 1000,
  scopesMaxEntries: 50,
  distinguishedNameMaxLength: 1000,
  filterMaxLength: 1000,
}

export function disabledSynchronisation(): IdentityProviderSynchronisation {
  return {
    enabled: false,
    state: 'disabled',
    lastCompletedAt: null,
    lastFailedAt: null,
    nextRunExpectedAt: null,
  }
}

export function initialIdentityProvider(): MockIdentityProvider {
  return {
    stored: null,
    clientSecret: null,
    bindPassword: null,
    version: 1,
    modifiedAt: null,
    mailboxCounts: { keycloak: 0, genericOidc: 0, ldap: 0 },
    synchronisation: disabledSynchronisation(),
    appReturnUrls: [...DEFAULT_APP_RETURN_URLS],
    connectionTest: { outcome: 'success' },
    rotateEtagOnNextWrite: false,
    removedElsewhere: false,
    capabilities: {},
  }
}

/** A complete Keycloak configuration with legacy defaults. */
export function storedKeycloak(overrides: Partial<StoredKeycloak> = {}): StoredKeycloak {
  return {
    type: 'keycloak',
    serverUrl: 'https://sso.example.org',
    realm: 'example',
    clientId: 'mailcow',
    version: '26.0.7',
    legacyReturnUrl: 'https://mail.example.org',
    additionalReturnUrls: [],
    mailpasswordFlow: false,
    importUsers: false,
    periodicSync: false,
    syncInterval: 15,
    attributeMapping: [],
    defaultTemplate: null,
    createMailboxOnSignIn: true,
    ignoreTlsErrors: false,
    ...overrides,
  }
}

/** A complete generic OIDC configuration with legacy defaults. */
export function storedGenericOidc(overrides: Partial<StoredGenericOidc> = {}): StoredGenericOidc {
  return {
    type: 'genericOidc',
    authorizationEndpoint: 'https://login.example.org/oauth2/authorize',
    tokenEndpoint: 'https://login.example.org/oauth2/token',
    userInfoEndpoint: 'https://login.example.org/oauth2/userinfo',
    clientId: 'mailcow',
    scopes: IDP_DEFAULTS.scopes,
    legacyReturnUrl: 'https://mail.example.org',
    additionalReturnUrls: [],
    attributeMapping: [],
    defaultTemplate: null,
    createMailboxOnSignIn: true,
    ignoreTlsErrors: false,
    ...overrides,
  }
}

/** A complete LDAP configuration with legacy defaults. */
export function storedLdap(overrides: Partial<StoredLdap> = {}): StoredLdap {
  return {
    type: 'ldap',
    hosts: ['ldap1.example.org'],
    port: 389,
    useSsl: false,
    useStartTls: false,
    baseDn: 'dc=example,dc=org',
    usernameField: 'mail',
    filter: null,
    attributeField: 'title',
    bindDn: 'cn=admin,dc=example,dc=org',
    importUsers: false,
    periodicSync: false,
    syncInterval: 15,
    attributeMapping: [{ attributeValue: 'staff', template: 'Staff' }],
    defaultTemplate: null,
    createMailboxOnSignIn: true,
    ignoreTlsErrors: false,
    ...overrides,
  }
}

const empty = (value: unknown) =>
  value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)

/** The settings legacy requires before it uses a provider, by type (with the secret's name). */
const REQUIRED: Record<IdentityProviderType, string[]> = {
  keycloak: ['serverUrl', 'realm', 'clientId', 'version', 'legacyReturnUrl', 'clientSecret'],
  genericOidc: [
    'authorizationEndpoint',
    'tokenEndpoint',
    'userInfoEndpoint',
    'clientId',
    'legacyReturnUrl',
    'clientSecret',
  ],
  ldap: ['hosts', 'baseDn', 'bindDn', 'bindPassword'],
}

/** The settings of a stored configuration that are missing for sign-in. */
export function missingSettings(state: MockIdentityProvider): string[] {
  const stored = state.stored
  if (!stored) return []
  return REQUIRED[stored.type].filter((name) => {
    if (name === 'clientSecret') return !state.clientSecret
    if (name === 'bindPassword') return !state.bindPassword
    return empty((stored as Record<string, unknown>)[name])
  })
}

/** The version tag over every stored setting, secrets included (as the API's HMAC). */
export function identityProviderEtag(state: MockIdentityProvider): string {
  const input = JSON.stringify([
    state.stored,
    state.clientSecret,
    state.bindPassword,
    state.version,
  ])
  return `"idp${createHash('sha256').update(input).digest('hex').slice(0, 24)}"`
}

/** The API's representation of the stored configuration; templates are checked by name. */
export function identityProviderView(
  state: MockIdentityProvider,
  templateNames: readonly string[],
): IdentityProvider {
  const stored = state.stored
  if (!stored) throw new Error('no identity provider configuration is stored')
  const exists = (name: string) => templateNames.includes(name)
  const missing = missingSettings(state)
  const common = {
    attributeMapping: stored.attributeMapping.map((entry) => ({
      ...entry,
      templateExists: exists(entry.template),
    })),
    defaultTemplate: stored.defaultTemplate,
    defaultTemplateExists: stored.defaultTemplate === null ? null : exists(stored.defaultTemplate),
    createMailboxOnSignIn: stored.createMailboxOnSignIn,
    ignoreTlsErrors: stored.ignoreTlsErrors,
    complete: missing.length === 0,
    missingSettings: missing,
    mailboxCounts: { ...state.mailboxCounts },
    modifiedAt: state.modifiedAt,
    etag: identityProviderEtag(state),
  }
  const synchronisation = (importUsers: boolean, periodicSync: boolean) =>
    importUsers || periodicSync
      ? { ...state.synchronisation, enabled: true }
      : disabledSynchronisation()
  // The generated types mark read-only members (`$Read<…>`); a mock builds the plain JSON.
  const view = (value: unknown) => value as IdentityProvider
  switch (stored.type) {
    case 'keycloak':
      return view({
        ...stored,
        ...common,
        type: 'keycloak',
        additionalReturnUrls: [...stored.additionalReturnUrls],
        appReturnUrls: [...state.appReturnUrls],
        clientSecretSet: !!state.clientSecret,
        synchronisation: synchronisation(stored.importUsers, stored.periodicSync),
      })
    case 'genericOidc':
      return view({
        ...stored,
        ...common,
        type: 'genericOidc',
        additionalReturnUrls: [...stored.additionalReturnUrls],
        appReturnUrls: [...state.appReturnUrls],
        clientSecretSet: !!state.clientSecret,
      })
    case 'ldap':
      return view({
        ...stored,
        ...common,
        type: 'ldap',
        hosts: [...stored.hosts],
        effectivePort: stored.useSsl && stored.port === 389 ? 636 : stored.port,
        bindPasswordSet: !!state.bindPassword,
        synchronisation: synchronisation(stored.importUsers, stored.periodicSync),
      })
  }
}

/** The capabilities read, with the scenario's overrides. */
export function identityProviderCapabilities(
  state: MockIdentityProvider,
): IdentityProviderCapabilities {
  const { defaults, limits, ...rest } = state.capabilities
  return {
    configured: state.stored !== null,
    configuredType: state.stored?.type ?? null,
    appReturnUrls: [...state.appReturnUrls],
    types: [
      { type: 'keycloak', singleSignOn: true, passwordSignIn: true, synchronisation: true },
      { type: 'genericOidc', singleSignOn: true, passwordSignIn: false, synchronisation: false },
      { type: 'ldap', singleSignOn: false, passwordSignIn: true, synchronisation: true },
    ],
    defaults: { ...IDP_DEFAULTS, ...defaults },
    limits: { ...IDP_LIMITS, ...limits },
    providerTimeoutSeconds: 7,
    singleSignOn: { pendingLifetimeSeconds: 600, renewalIntervalSeconds: 300 },
    ...rest,
  }
}

/** A connection test result of the given outcome. */
export function connectionTestResult(
  type: IdentityProviderType,
  testedAddress: string,
  outcome: MockConnectionTest['outcome'],
  testedAt: string,
  providerStatus: number | null = null,
): IdentityProviderConnectionTestResult {
  return {
    type,
    testedAddress,
    testedAt,
    outcome: outcome === 'success' ? 'success' : 'failure',
    failureCategory: outcome === 'success' ? null : outcome,
    providerStatus:
      outcome === 'unexpectedResponse'
        ? (providerStatus ?? 404)
        : outcome === 'success'
          ? 200
          : null,
  }
}
