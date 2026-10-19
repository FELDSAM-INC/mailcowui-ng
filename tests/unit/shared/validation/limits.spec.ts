// Every client-side limit equals its value in the pinned contract (data-model §6), so a contract
// bump cannot leave a stale limit behind.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import * as limits from '@/shared/validation/limits'

type Json = { [key: string]: unknown }

const contract = JSON.parse(
  readFileSync(join(process.cwd(), 'contract/openapi.json'), 'utf8'),
) as Json

function resolve(node: unknown): unknown {
  let current = node
  while (current && typeof current === 'object' && '$ref' in current) {
    const ref = (current as { $ref: string }).$ref
    current = pointer(ref.replace(/^#/, ''))
  }
  return current
}

function pointer(path: string): unknown {
  let node: unknown = contract
  for (const raw of path.split('/').slice(1)) {
    const part = raw.replace(/~1/g, '/').replace(/~0/g, '~')
    node = resolve(node)
    if (!node || typeof node !== 'object') return undefined
    node = (node as Json)[part]
  }
  return resolve(node)
}

function schemaValue(schema: string, ...path: string[]): unknown {
  return pointer(['', 'components', 'schemas', schema, ...path].join('/'))
}

function queryParameter(path: string, method: string, name: string): Json {
  const operation = pointer(`/paths/${path.replace(/\//g, '~1')}/${method}`) as Json
  const parameters = (operation.parameters as unknown[]).map(resolve) as Json[]
  const parameter = parameters.find((p) => p.name === name && p.in === 'query')
  if (!parameter) throw new Error(`No query parameter ${name} on ${method} ${path}`)
  return resolve(parameter.schema) as Json
}

describe('contract limits (data-model §6)', () => {
  const cases: [keyof typeof limits, unknown][] = [
    [
      'USERNAME_MAX_LENGTH',
      schemaValue('PasswordSignInRequest', 'properties', 'username', 'maxLength'),
    ],
    [
      'PASSWORD_MAX_LENGTH',
      schemaValue('PasswordSignInRequest', 'properties', 'password', 'maxLength'),
    ],
    ['PASSKEY_NAME_MAX_LENGTH', schemaValue('PasskeyPatch', 'properties', 'name', 'maxLength')],
    [
      'PASSKEY_NAME_MAX_LENGTH',
      schemaValue('PasskeyRegistrationRequest', 'properties', 'name', 'maxLength'),
    ],
    [
      'API_KEY_NAME_MAX_LENGTH',
      schemaValue('ApiKeyCreateRequest', 'properties', 'name', 'maxLength'),
    ],
    [
      'API_KEY_OWNER_MAX_LENGTH',
      schemaValue('ApiKeyCreateRequest', 'properties', 'ownerUsername', 'maxLength'),
    ],
    ['API_KEY_OWNER_MAX_LENGTH', queryParameter('/api-keys', 'get', 'ownerUsername').maxLength],
    [
      'ALLOWED_NETWORKS_MAX_ITEMS',
      schemaValue('ApiKeyCreateRequest', 'properties', 'allowedNetworks', 'maxItems'),
    ],
    [
      'NETWORK_MAX_LENGTH',
      schemaValue('ApiKeyCreateRequest', 'properties', 'allowedNetworks', 'items', 'maxLength'),
    ],
    ['AUDIT_EVENT_TYPES_MAX_ITEMS', queryParameter('/audit-events', 'get', 'eventType').maxItems],
    ['AUDIT_ACTOR_MAX_LENGTH', queryParameter('/audit-events', 'get', 'actor').maxLength],
    ['AUDIT_ADDRESS_MAX_LENGTH', queryParameter('/audit-events', 'get', 'clientAddress').maxLength],
    // UI 002 (T021): the domain, template, footer and audit target limits.
    ['DOMAIN_TAG_FILTER_MAX_ITEMS', queryParameter('/domains', 'get', 'tag').maxItems],
    ['DOMAIN_TAG_MAX_LENGTH', (queryParameter('/domains', 'get', 'tag').items as Json).maxLength],
    ['DOMAIN_TAG_MAX_LENGTH', schemaValue('DomainTagList', 'items', 'maxLength')],
    [
      'DOMAIN_LIMIT_MIN',
      schemaValue('DomainCreateRequest', 'properties', 'maxMailboxes', 'minimum'),
    ],
    [
      'DOMAIN_LIMIT_MAX',
      schemaValue('DomainCreateRequest', 'properties', 'maxMailboxes', 'maximum'),
    ],
    ['DOMAIN_LIMIT_MAX', schemaValue('DomainCreateRequest', 'properties', 'maxAliases', 'maximum')],
    ['RATE_LIMIT_MIN', schemaValue('DomainRateLimit', 'properties', 'value', 'minimum')],
    ['RATE_LIMIT_MAX', schemaValue('DomainRateLimit', 'properties', 'value', 'maximum')],
    ['QUOTA_MAX_BYTES', schemaValue('DomainCreateRequest', 'properties', 'domainQuota', 'maximum')],
    [
      'TEMPLATE_NAME_MAX_LENGTH',
      schemaValue('DomainTemplateCreateRequest', 'properties', 'name', 'maxLength'),
    ],
    [
      'DKIM_SELECTOR_MAX_LENGTH',
      schemaValue('DomainCreateRequest', 'properties', 'dkimSelector', 'maxLength'),
    ],
    [
      'FOOTER_EXCLUSION_MAX_LENGTH',
      schemaValue('DomainFooterReplace', 'properties', 'excludedAddresses', 'items', 'maxLength'),
    ],
    ['SEARCH_MAX_LENGTH', queryParameter('/domains', 'get', 'q').maxLength],
    ['SEARCH_MAX_LENGTH', queryParameter('/domain-templates', 'get', 'q').maxLength],
    ['AUDIT_TARGET_ID_MAX_LENGTH', queryParameter('/audit-events', 'get', 'targetId').maxLength],
    // UI 003 (T020)
    ['MAILBOX_ADDRESS_MAX', schemaValue('Mailbox', 'properties', 'address', 'maxLength')],
    ['MAILBOX_DISPLAY_NAME_MAX', schemaValue('Mailbox', 'properties', 'displayName', 'maxLength')],
    [
      'MAILBOX_PASSWORD_MAX',
      schemaValue('MailboxCreateRequest', 'properties', 'password', 'maxLength'),
    ],
    [
      'MAILBOX_TEMPLATE_NAME_MAX',
      schemaValue('MailboxTemplate', 'properties', 'name', 'maxLength'),
    ],
    ['MAILBOX_RATE_LIMIT_MAX', schemaValue('MailboxRateLimit', 'properties', 'value', 'maximum')],
    ['MAILBOX_RATE_LIMIT_MIN', schemaValue('MailboxRateLimit', 'properties', 'value', 'minimum')],
    [
      'MAILBOX_RECOVERY_EMAIL_MAX',
      schemaValue('MailboxPatch', 'properties', 'recoveryEmail', 'oneOf', '0', 'maxLength'),
    ],
    ['SEARCH_MAX_LENGTH', queryParameter('/mailboxes', 'get', 'q').maxLength],
    // UI 012 (T006): identity provider, single sign-on and OAuth2 client fields that the
    // capabilities read does not carry.
    [
      'KEYCLOAK_REALM_MAX_LENGTH',
      schemaValue(
        'IdentityProviderKeycloakInput',
        'allOf',
        '2',
        'properties',
        'realm',
        'maxLength',
      ),
    ],
    [
      'PROVIDER_CLIENT_ID_MAX_LENGTH',
      schemaValue(
        'IdentityProviderKeycloakInput',
        'allOf',
        '2',
        'properties',
        'clientId',
        'maxLength',
      ),
    ],
    [
      'PROVIDER_CLIENT_ID_MAX_LENGTH',
      schemaValue(
        'IdentityProviderGenericOidcInput',
        'allOf',
        '2',
        'properties',
        'clientId',
        'maxLength',
      ),
    ],
    [
      'KEYCLOAK_VERSION_MAX_LENGTH',
      schemaValue(
        'IdentityProviderKeycloakInput',
        'allOf',
        '2',
        'properties',
        'version',
        'maxLength',
      ),
    ],
    [
      'LDAP_HOST_MAX_LENGTH',
      schemaValue(
        'IdentityProviderLdapInput',
        'allOf',
        '1',
        'properties',
        'hosts',
        'items',
        'maxLength',
      ),
    ],
    [
      'LDAP_PORT_MIN',
      schemaValue('IdentityProviderLdapInput', 'allOf', '1', 'properties', 'port', 'minimum'),
    ],
    [
      'LDAP_PORT_MAX',
      schemaValue('IdentityProviderLdapInput', 'allOf', '1', 'properties', 'port', 'maximum'),
    ],
    [
      'LDAP_ATTRIBUTE_MAX_LENGTH',
      schemaValue(
        'IdentityProviderLdapInput',
        'allOf',
        '1',
        'properties',
        'usernameField',
        'maxLength',
      ),
    ],
    [
      'MAPPING_TEMPLATE_MAX_LENGTH',
      schemaValue('IdentityProviderMappingEntryInput', 'properties', 'template', 'maxLength'),
    ],
    [
      'SSO_CODE_MAX_LENGTH',
      schemaValue('SingleSignOnCompletionRequest', 'properties', 'code', 'maxLength'),
    ],
    [
      'SSO_STATE_MAX_LENGTH',
      schemaValue('SingleSignOnCompletionRequest', 'properties', 'state', 'maxLength'),
    ],
    [
      'SSO_STATE_MAX_LENGTH',
      schemaValue('SingleSignOnProviderErrorRequest', 'properties', 'state', 'maxLength'),
    ],
    [
      'REDIRECT_URI_MAX_LENGTH',
      schemaValue('Oauth2ClientCreateRequest', 'properties', 'redirectUris', 'items', 'maxLength'),
    ],
    // UI 010 (T009): DKIM and MTA-STS.
    ['SEARCH_MAX_LENGTH', queryParameter('/dkim-keys', 'get', 'q').maxLength],
    ['SEARCH_MAX_LENGTH', queryParameter('/mta-sts-policies', 'get', 'q').maxLength],
    [
      'DKIM_NAME_MAX_LENGTH',
      schemaValue('DkimKeyGenerateRequest', 'properties', 'name', 'maxLength'),
    ],
    ['DKIM_SELECTOR_FILTER_MAX_LENGTH', queryParameter('/dkim-keys', 'get', 'selector').maxLength],
    ['DKIM_DOMAIN_FILTER_MAX_LENGTH', queryParameter('/dkim-keys', 'get', 'domain').maxLength],
    [
      'MTA_STS_MX_HOSTS_MAX_ITEMS',
      schemaValue('MtaStsPolicyCreateRequest', 'properties', 'mxHosts', 'maxItems'),
    ],
    [
      'MTA_STS_MX_HOST_MAX_LENGTH',
      schemaValue('MtaStsPolicyCreateRequest', 'properties', 'mxHosts', 'items', 'maxLength'),
    ],
  ]

  // UI 012 (T006): syntax rules of the contract, compared as pattern sources.
  const patterns: [keyof typeof limits, unknown][] = [
    [
      'KEYCLOAK_VERSION_PATTERN',
      schemaValue(
        'IdentityProviderKeycloakInput',
        'allOf',
        '2',
        'properties',
        'version',
        'pattern',
      ),
    ],
    [
      'LDAP_ATTRIBUTE_PATTERN',
      schemaValue(
        'IdentityProviderLdapInput',
        'allOf',
        '1',
        'properties',
        'usernameField',
        'pattern',
      ),
    ],
    [
      'SCOPES_PATTERN',
      schemaValue(
        'IdentityProviderGenericOidcInput',
        'allOf',
        '2',
        'properties',
        'scopes',
        'pattern',
      ),
    ],
    [
      'OAUTH_ERROR_CODE_PATTERN',
      schemaValue('SingleSignOnProviderErrorRequest', 'properties', 'error', 'pattern'),
    ],
  ]

  // UI 011 (T026): the largest page, the rate limit bucket identifier and the ban parameters.
  const parameter = (name: string, ...path: string[]) =>
    pointer(['/components/parameters', name, ...path].join('/'))
  const f2b = (...path: string[]) => schemaValue('Fail2BanSettingsPatch', 'properties', ...path)
  cases.push(
    ['LIST_LIMIT_MAX', parameter('Limit', 'schema', 'maximum')],
    ['RATE_LIMIT_BUCKET_ID_MAX_LENGTH', parameter('RateLimitBucketId', 'schema', 'maxLength')],
    ['F2B_BAN_TIME_MIN', f2b('banTime', 'minimum')],
    ['F2B_BAN_TIME_MIN', f2b('maxBanTime', 'minimum')],
    ['F2B_NUMBER_MAX', f2b('banTime', 'maximum')],
    ['F2B_NUMBER_MAX', f2b('maxBanTime', 'maximum')],
    ['F2B_NUMBER_MAX', f2b('maxAttempts', 'maximum')],
    ['F2B_NUMBER_MAX', f2b('retryWindow', 'maximum')],
    ['F2B_ATTEMPTS_MIN', f2b('maxAttempts', 'minimum')],
    ['F2B_ATTEMPTS_MIN', f2b('retryWindow', 'minimum')],
    ['F2B_PREFIX_MIN', f2b('ipv4PrefixLength', 'minimum')],
    ['F2B_PREFIX_MIN', f2b('ipv6PrefixLength', 'minimum')],
    ['F2B_IPV4_PREFIX_MAX', f2b('ipv4PrefixLength', 'maximum')],
    ['F2B_IPV6_PREFIX_MAX', f2b('ipv6PrefixLength', 'maximum')],
    ['F2B_LIST_ENTRY_MAX_LENGTH', f2b('allowlist', 'items', 'maxLength')],
    ['F2B_LIST_ENTRY_MAX_LENGTH', f2b('denylist', 'items', 'maxLength')],
  )
  patterns.push(['RATE_LIMIT_BUCKET_ID_PATTERN', parameter('RateLimitBucketId', 'schema', 'pattern')])

  it.each(patterns)('%s has the contract pattern', (name, expected) => {
    expect(typeof expected).toBe('string')
    expect((limits[name] as RegExp).source).toBe(new RegExp(expected as string).source)
  })

  it.each(cases)('%s equals the contract value', (name, expected) => {
    expect(typeof expected).toBe('number')
    expect(limits[name]).toBe(expected)
  })

  it('has the values of data-model §6', () => {
    expect(limits.API_KEY_NAME_MAX_LENGTH).toBe(255)
    expect(limits.ALLOWED_NETWORKS_MAX_ITEMS).toBe(100)
    expect(limits.NETWORK_MAX_LENGTH).toBe(49)
    expect(limits.AUDIT_EVENT_TYPES_MAX_ITEMS).toBe(20)
    expect(limits.PASSWORD_MAX_LENGTH).toBe(4096)
    expect(limits.DOMAIN_TAG_FILTER_MAX_ITEMS).toBe(100)
    expect(limits.DOMAIN_LIMIT_MAX).toBe(2_147_483_647)
    expect(limits.RATE_LIMIT_MIN).toBe(1)
    expect(limits.QUOTA_MAX_BYTES).toBe(9_007_199_254_740_992)
    expect(limits.TEMPLATE_NAME_MAX_LENGTH).toBe(255)
    expect(limits.KEYCLOAK_REALM_MAX_LENGTH).toBe(255)
    expect(limits.KEYCLOAK_VERSION_MAX_LENGTH).toBe(64)
    expect(limits.LDAP_HOST_MAX_LENGTH).toBe(253)
    expect(limits.LDAP_PORT_MAX).toBe(65535)
    expect(limits.SSO_CODE_MAX_LENGTH).toBe(4096)
    expect(limits.SSO_STATE_MAX_LENGTH).toBe(512)
    expect(limits.REDIRECT_URI_MAX_LENGTH).toBe(2000)
  })

  it('tests every exported limit', () => {
    expect(Object.keys(limits).sort()).toEqual(
      [...new Set([...cases, ...patterns].map(([name]) => name))].sort(),
    )
  })
})
