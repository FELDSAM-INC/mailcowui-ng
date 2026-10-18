// The client rules of the identity provider form (T021, FR-018, data-model §6), with the limits of
// the capabilities read and the contract's syntax rules, and the secret rule (T022, FR-024,
// FR-025). The API stays authoritative; these catch slips before anything is sent.
import { describe, expect, it } from 'vitest'

import { formFromConfig, formFromDefaults } from '@/features/identity-providers/provider/form-model'
import { secretRequirement } from '@/features/identity-providers/provider/secret-rule'
import {
  isLdapHost,
  validateForm,
  type RuleMessage,
} from '@/features/identity-providers/provider/validation'

import {
  identityProviderCapabilities,
  initialIdentityProvider,
  storedGenericOidc,
  storedKeycloak,
  storedLdap,
  type StoredIdentityProvider,
} from '../../../../mocks/factories/identity-provider'
import { configOf } from './fixtures'

const capabilities = identityProviderCapabilities(initialIdentityProvider())
const stored = (value: StoredIdentityProvider) => configOf(value)

const keys = (errors: Record<string, RuleMessage[]>, path: string) =>
  (errors[path] ?? []).map((message) => message.key)

function keycloak() {
  return Object.assign(formFromDefaults(capabilities), {
    serverUrl: 'https://sso.example.org',
    realm: 'example',
    clientId: 'mailcow',
    clientSecret: 'secret',
    version: '26.0.7',
    legacyReturnUrl: 'https://mail.example.org',
  })
}

function ldap() {
  return Object.assign(formFromDefaults(capabilities), {
    type: 'ldap' as const,
    hosts: 'ldap1.example.org',
    baseDn: 'dc=example,dc=org',
    bindDn: 'cn=admin,dc=example,dc=org',
    bindPassword: 'secret',
  })
}

const limits = capabilities.limits

describe('validateForm', () => {
  it('accepts complete forms of each type', () => {
    expect(validateForm(keycloak(), { limits, secret: 'noStoredSecret' })).toEqual({})
    expect(validateForm(ldap(), { limits, secret: 'noStoredSecret' })).toEqual({})
    const oidc = formFromConfig(stored(storedGenericOidc()), capabilities)
    expect(validateForm(oidc, { limits, secret: null })).toEqual({})
  })

  it('marks required, URL, realm and version rules at their fields', () => {
    const form = Object.assign(keycloak(), {
      serverUrl: 'sso.example.org',
      realm: 'a/b',
      version: '26.x',
      clientId: '',
      legacyReturnUrl: '',
    })
    const errors = validateForm(form, { limits, secret: null })
    expect(keys(errors, 'serverUrl')).toEqual(['validation.format.httpUrl'])
    expect(keys(errors, 'realm')).toEqual(['validation.format.keycloakRealm'])
    expect(keys(errors, 'version')).toEqual(['validation.format.keycloakVersion'])
    expect(keys(errors, 'clientId')).toEqual(['validation.required'])
    expect(keys(errors, 'legacyReturnUrl')).toEqual(['validation.required'])
  })

  it('checks the additional return URLs: format, length, count and duplicates', () => {
    const form = Object.assign(keycloak(), {
      additionalReturnUrls: [
        'https://a.example.org',
        'ftp://x',
        'https://a.example.org',
        `https://x.example.org/${'a'.repeat(2000)}`,
      ],
    })
    const errors = validateForm(form, { limits, secret: null })
    expect(keys(errors, 'additionalReturnUrls.1')).toEqual(['validation.format.httpUrl'])
    expect(keys(errors, 'additionalReturnUrls.2')).toEqual(['validation.duplicate'])
    expect(keys(errors, 'additionalReturnUrls.3')).toEqual(['validation.tooLong'])
    const many = Object.assign(keycloak(), {
      additionalReturnUrls: Array.from({ length: 101 }, (_, i) => `https://h${i}.example.org`),
    })
    expect(keys(validateForm(many, { limits, secret: null }), 'additionalReturnUrls')).toEqual([
      'validation.tooMany',
    ])
  })

  it('checks the scopes of a generic OIDC provider', () => {
    const form = formFromConfig(stored(storedGenericOidc()), capabilities)
    for (const scopes of ['openid  profile', 'openid "x"', Array(51).fill('s').join(' ')]) {
      form.scopes = scopes
      expect(keys(validateForm(form, { limits, secret: null }), 'scopes'), scopes).toEqual([
        'validation.format.scopeList',
      ])
    }
    form.scopes = ''
    expect(validateForm(form, { limits, secret: null })).toEqual({})
  })

  it('checks LDAP hosts, port, filter, attribute names and the attribute field rule', () => {
    const form = Object.assign(ldap(), {
      hosts: Array.from({ length: 11 }, (_, i) => `ldap${i}.example.org`).join(','),
      port: '70000',
      filter: '(&(a=b)(c=d)',
      usernameField: '1mail',
      importUsers: true,
      attributeField: '',
    })
    const errors = validateForm(form, { limits, secret: null })
    expect(keys(errors, 'hosts')).toEqual(['validation.tooMany'])
    expect(keys(errors, 'port')).toEqual(['validation.outOfRange'])
    expect(keys(errors, 'filter')).toEqual(['validation.format.ldapFilter'])
    expect(keys(errors, 'usernameField')).toEqual(['validation.format.ldapAttribute'])
    expect(keys(errors, 'attributeField')).toEqual(['validation.required'])
    form.hosts = 'ldap_1.example.org'
    expect(keys(validateForm(form, { limits, secret: null }), 'hosts')).toEqual([
      'validation.format.hostName',
    ])
    form.hosts = ' , '
    expect(keys(validateForm(form, { limits, secret: null }), 'hosts')).toEqual([
      'validation.required',
    ])
  })

  it('checks the sync interval range and the secret length and requirement', () => {
    const form = Object.assign(ldap(), { syncInterval: '10081', bindPassword: 'x'.repeat(1001) })
    const errors = validateForm(form, { limits, secret: null })
    expect(keys(errors, 'syncInterval')).toEqual(['validation.outOfRange'])
    expect(keys(errors, 'bindPassword')).toEqual(['validation.tooLong'])
    form.bindPassword = ''
    form.syncInterval = '15'
    expect(validateForm(form, { limits, secret: 'addressChanged' }).bindPassword).toEqual([
      { key: 'validation.secretRequiredReason.addressChanged' },
    ])
  })

  it('checks the mapping: values, templates, letter case and duplicates', () => {
    const form = Object.assign(keycloak(), {
      attributeMapping: [
        { attributeValue: 'Staff', template: 'Staff' },
        { attributeValue: 'staff', template: 'Staff' },
        { attributeValue: 'Staff', template: 'Staff' },
        { attributeValue: '', template: 'Staff' },
        { attributeValue: 'it', template: '' },
        { attributeValue: '', template: '' },
      ],
    })
    const errors = validateForm(form, { limits, secret: null })
    expect(keys(errors, 'attributeMapping.0.attributeValue')).toEqual([])
    expect(keys(errors, 'attributeMapping.1.attributeValue')).toEqual([])
    expect(keys(errors, 'attributeMapping.2.attributeValue')).toEqual(['validation.duplicate'])
    expect(keys(errors, 'attributeMapping.3.attributeValue')).toEqual(['validation.required'])
    expect(keys(errors, 'attributeMapping.4.template')).toEqual(['validation.required'])
    expect(Object.keys(errors).some((path) => path.startsWith('attributeMapping.5'))).toBe(false)
  })
})

describe('isLdapHost', () => {
  it.each(['openldap', 'ldap1.example.org', '192.0.2.10', '2001:db8::1'])('accepts %s', (host) => {
    expect(isLdapHost(host)).toBe(true)
  })
  it.each([
    'ldap_1.example.org',
    '192.0.2.10/24',
    `${'a'.repeat(64)}.example.org`,
    `${'a.'.repeat(126)}ab`,
    '-ldap.example.org',
  ])('refuses %s', (host) => {
    expect(isLdapHost(host)).toBe(false)
  })
})

describe('secretRequirement', () => {
  it('requires the secret in the setup and for another type', () => {
    expect(secretRequirement(keycloak(), null)).toBe('noStoredSecret')
    const config = stored(storedKeycloak())
    const form = formFromConfig(config, capabilities)
    form.type = 'genericOidc'
    expect(secretRequirement(form, config)).toBe('typeChanged')
  })

  it('keeps the stored secret while the address is unchanged', () => {
    const config = stored(storedKeycloak())
    const form = formFromConfig(config, capabilities)
    form.realm = 'other'
    expect(secretRequirement(form, config)).toBeNull()
    form.serverUrl = 'https://sso.example.org/'
    expect(secretRequirement(form, config)).toBeNull()
  })

  it('requires it again when the address that receives it changes', () => {
    const kc = stored(storedKeycloak())
    const kcForm = formFromConfig(kc, capabilities)
    kcForm.serverUrl = 'https://other.example.org'
    expect(secretRequirement(kcForm, kc)).toBe('addressChanged')
    const oidc = stored(storedGenericOidc())
    const oidcForm = formFromConfig(oidc, capabilities)
    oidcForm.tokenEndpoint = 'https://login.example.org/other'
    expect(secretRequirement(oidcForm, oidc)).toBe('addressChanged')
    oidcForm.tokenEndpoint = oidc.type === 'genericOidc' ? (oidc.tokenEndpoint ?? '') : ''
    oidcForm.authorizationEndpoint = 'https://elsewhere.example.org'
    expect(secretRequirement(oidcForm, oidc)).toBeNull()
    const directory = stored(storedLdap({ hosts: ['a.example.org', 'b.example.org'] }))
    const ldapForm = formFromConfig(directory, capabilities)
    ldapForm.hosts = 'b.example.org, a.example.org'
    expect(secretRequirement(ldapForm, directory)).toBe('addressChanged')
  })

  it('requires it when the stored configuration has none', () => {
    const config = configOf(storedKeycloak(), [], { clientSecret: null })
    expect(secretRequirement(formFromConfig(config, capabilities), config)).toBe('noStoredSecret')
  })
})
