// The identity provider form (UI 012 US1, US4, research R11, plan "Legacy form map"): one model for
// the three types of the classic tab, so that switching the type keeps what both forms share, as
// legacy prefills every type's form with the same settings. Values are typed as they are entered
// (text, switches, entries); `toInput` builds the generated save and test body, and `toPatch` the
// merge patch of a change. Secrets are never prefilled: an empty secret keeps the stored one.
import type {
  IdentityProvider,
  IdentityProviderCapabilities,
  IdentityProviderGenericOidcInput,
  IdentityProviderInput,
  IdentityProviderKeycloakInput,
  IdentityProviderLdapInput,
  IdentityProviderPatch,
  IdentityProviderType,
  Writable,
} from '@/api'

/** The request bodies, with the write-only secrets as plain values. */
export type ProviderInput = Writable<IdentityProviderInput>
export type ProviderPatch = Writable<IdentityProviderPatch>

export interface MappingRow {
  attributeValue: string
  template: string
}

export interface ProviderForm {
  type: IdentityProviderType
  // Keycloak
  serverUrl: string
  realm: string
  version: string
  mailpasswordFlow: boolean
  // Generic OIDC
  authorizationEndpoint: string
  tokenEndpoint: string
  userInfoEndpoint: string
  scopes: string
  // Keycloak and generic OIDC
  clientId: string
  clientSecret: string
  legacyReturnUrl: string
  additionalReturnUrls: string[]
  // LDAP: legacy's one host field, comma-separated
  hosts: string
  port: string
  useSsl: boolean
  useStartTls: boolean
  baseDn: string
  usernameField: string
  filter: string
  attributeField: string
  bindDn: string
  bindPassword: string
  // Keycloak and LDAP
  importUsers: boolean
  periodicSync: boolean
  syncInterval: string
  // Every type
  attributeMapping: MappingRow[]
  defaultTemplate: string
  createMailboxOnSignIn: boolean
  ignoreTlsErrors: boolean
}

export type Defaults = IdentityProviderCapabilities['defaults']

/** The members that receive a secret, by type, and the secret's name (FR-025). */
export const SECRET_OF = {
  keycloak: 'clientSecret',
  genericOidc: 'clientSecret',
  ldap: 'bindPassword',
} as const satisfies Record<IdentityProviderType, keyof ProviderForm>

export const ADDRESS_OF = {
  keycloak: 'serverUrl',
  genericOidc: 'tokenEndpoint',
  ldap: 'hosts',
} as const satisfies Record<IdentityProviderType, keyof ProviderForm>

/** A new form: Keycloak chosen, as the classic select does, and the capabilities' defaults. */
export function formFromDefaults(capabilities: IdentityProviderCapabilities): ProviderForm {
  const d = capabilities.defaults
  return {
    type: 'keycloak',
    serverUrl: '',
    realm: '',
    version: '',
    mailpasswordFlow: d.mailpasswordFlow,
    authorizationEndpoint: '',
    tokenEndpoint: '',
    userInfoEndpoint: '',
    scopes: '',
    clientId: '',
    clientSecret: '',
    legacyReturnUrl: '',
    additionalReturnUrls: [],
    hosts: '',
    port: String(d.port),
    useSsl: d.useSsl,
    useStartTls: d.useStartTls,
    baseDn: '',
    usernameField: '',
    filter: '',
    attributeField: '',
    bindDn: '',
    bindPassword: '',
    importUsers: d.importUsers,
    periodicSync: d.periodicSync,
    syncInterval: String(d.syncInterval),
    attributeMapping: [],
    defaultTemplate: '',
    createMailboxOnSignIn: d.createMailboxOnSignIn,
    ignoreTlsErrors: d.ignoreTlsErrors,
  }
}

const text = (value: string | null | undefined) => value ?? ''

/** The form of a stored configuration; the other types' fields keep their defaults. */
export function formFromConfig(
  config: IdentityProvider,
  capabilities: IdentityProviderCapabilities,
): ProviderForm {
  const form: ProviderForm = {
    ...formFromDefaults(capabilities),
    type: config.type,
    attributeMapping: config.attributeMapping.map(({ attributeValue, template }) => ({
      attributeValue,
      template,
    })),
    defaultTemplate: text(config.defaultTemplate),
    createMailboxOnSignIn: config.createMailboxOnSignIn,
    ignoreTlsErrors: config.ignoreTlsErrors,
  }
  switch (config.type) {
    case 'keycloak':
      return {
        ...form,
        serverUrl: text(config.serverUrl),
        realm: text(config.realm),
        clientId: text(config.clientId),
        version: text(config.version),
        mailpasswordFlow: config.mailpasswordFlow,
        legacyReturnUrl: text(config.legacyReturnUrl),
        additionalReturnUrls: [...config.additionalReturnUrls],
        importUsers: config.importUsers,
        periodicSync: config.periodicSync,
        syncInterval: String(config.syncInterval),
      }
    case 'genericOidc':
      return {
        ...form,
        authorizationEndpoint: text(config.authorizationEndpoint),
        tokenEndpoint: text(config.tokenEndpoint),
        userInfoEndpoint: text(config.userInfoEndpoint),
        clientId: text(config.clientId),
        scopes: config.scopes,
        legacyReturnUrl: text(config.legacyReturnUrl),
        additionalReturnUrls: [...config.additionalReturnUrls],
      }
    case 'ldap':
      return {
        ...form,
        hosts: config.hosts.join(', '),
        port: String(config.port),
        useSsl: config.useSsl,
        useStartTls: config.useStartTls,
        baseDn: text(config.baseDn),
        usernameField: config.usernameField,
        filter: text(config.filter),
        attributeField: text(config.attributeField),
        bindDn: text(config.bindDn),
        importUsers: config.importUsers,
        periodicSync: config.periodicSync,
        syncInterval: String(config.syncInterval),
      }
  }
}

/** Legacy's host field as a list: split on commas, trimmed, empty entries dropped. */
export function splitHosts(value: string): string[] {
  return value
    .split(',')
    .map((host) => host.trim())
    .filter((host) => host !== '')
}

const orNull = (value: string) => (value.trim() === '' ? null : value.trim())
const whole = (value: string) => Number(value.trim())

/** The mapping entries the user filled in; a row left completely empty is ignored. */
export function mappingInput(rows: readonly MappingRow[]) {
  return rows
    .filter((row) => row.attributeValue.trim() !== '' || row.template !== '')
    .map((row) => ({ attributeValue: row.attributeValue.trim(), template: row.template }))
}

const urls = (values: readonly string[]) =>
  values.map((value) => value.trim()).filter((value) => value !== '')

/**
 * The whole configuration of the form's type: the body of a save (`PUT`) and of a connection test.
 * The secret is sent only when typed; empty optional values are `null`; an empty username field or
 * scope list takes the default, as legacy's placeholders say.
 */
export function toInput(form: ProviderForm, defaults: Defaults): ProviderInput {
  const common = {
    attributeMapping: mappingInput(form.attributeMapping),
    defaultTemplate: orNull(form.defaultTemplate),
    createMailboxOnSignIn: form.createMailboxOnSignIn,
    ignoreTlsErrors: form.ignoreTlsErrors,
  }
  switch (form.type) {
    case 'keycloak': {
      const input: Writable<IdentityProviderKeycloakInput> = {
        type: 'keycloak',
        serverUrl: form.serverUrl.trim(),
        realm: form.realm.trim(),
        clientId: form.clientId.trim(),
        version: form.version.trim(),
        legacyReturnUrl: form.legacyReturnUrl.trim(),
        additionalReturnUrls: urls(form.additionalReturnUrls),
        mailpasswordFlow: form.mailpasswordFlow,
        importUsers: form.importUsers,
        periodicSync: form.periodicSync,
        syncInterval: whole(form.syncInterval),
        ...common,
      }
      if (form.clientSecret !== '') input.clientSecret = form.clientSecret
      return input
    }
    case 'genericOidc': {
      const input: Writable<IdentityProviderGenericOidcInput> = {
        type: 'genericOidc',
        authorizationEndpoint: form.authorizationEndpoint.trim(),
        tokenEndpoint: form.tokenEndpoint.trim(),
        userInfoEndpoint: form.userInfoEndpoint.trim(),
        clientId: form.clientId.trim(),
        scopes: form.scopes.trim() || defaults.scopes,
        legacyReturnUrl: form.legacyReturnUrl.trim(),
        additionalReturnUrls: urls(form.additionalReturnUrls),
        ...common,
      }
      if (form.clientSecret !== '') input.clientSecret = form.clientSecret
      return input
    }
    case 'ldap': {
      const input: Writable<IdentityProviderLdapInput> = {
        type: 'ldap',
        hosts: splitHosts(form.hosts),
        port: whole(form.port),
        useSsl: form.useSsl,
        useStartTls: form.useStartTls,
        baseDn: form.baseDn.trim(),
        usernameField: form.usernameField.trim() || defaults.usernameField,
        filter: orNull(form.filter),
        attributeField: orNull(form.attributeField),
        bindDn: form.bindDn.trim(),
        importUsers: form.importUsers,
        periodicSync: form.periodicSync,
        syncInterval: whole(form.syncInterval),
        ...common,
      }
      if (form.bindPassword !== '') input.bindPassword = form.bindPassword
      return input
    }
  }
}

/**
 * The merge patch of a change of the stored type: the members whose value differs from the stored
 * one (arrays as whole lists), and the secret when typed. Null when nothing changed.
 */
export function toPatch(
  form: ProviderForm,
  config: IdentityProvider,
  defaults: Defaults,
  capabilities?: IdentityProviderCapabilities,
): ProviderPatch | null {
  if (form.type !== config.type) return null
  const caps = capabilities ?? ({ defaults } as IdentityProviderCapabilities)
  const before = toInput(formFromConfig(config, caps), defaults) as Record<string, unknown>
  const after = toInput(form, defaults) as Record<string, unknown>
  const patch: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(after)) {
    if (key === 'type') continue
    if (key === 'clientSecret' || key === 'bindPassword') {
      patch[key] = value
      continue
    }
    if (JSON.stringify(value) !== JSON.stringify(before[key])) patch[key] = value
  }
  return Object.keys(patch).length > 0 ? (patch) : null
}
