// The identity provider form model (T020, research R11, legacy form map): one form for the three
// types, prefilled from the capabilities' defaults or from a stored configuration; the whole input
// of a save or test, and the merge patch of a change. Request bodies pass the contract.
import { describe, expect, it } from 'vitest'

import type { IdentityProvider, IdentityProviderCapabilities } from '@/api'
import {
  formFromConfig,
  formFromDefaults,
  splitHosts,
  toInput,
  toPatch,
} from '@/features/identity-providers/provider/form-model'

import { contractValidator } from '../../../../mocks/contract/validator'
import {
  identityProviderCapabilities,
  identityProviderView,
  initialIdentityProvider,
  storedGenericOidc,
  storedKeycloak,
  storedLdap,
  type StoredIdentityProvider,
} from '../../../../mocks/factories/identity-provider'

const validator = contractValidator()
const capabilities: IdentityProviderCapabilities =
  identityProviderCapabilities(initialIdentityProvider())
const defaults = capabilities.defaults

function stored(value: StoredIdentityProvider, templates = ['Staff']): IdentityProvider {
  return identityProviderView(
    { ...initialIdentityProvider(), stored: value, clientSecret: 's', bindPassword: 'p' },
    templates,
  )
}

/** The contract violations of a request body (the mock validator, as every mocked request). */
function requestErrors(method: 'put' | 'patch' | 'post', path: string, body: unknown) {
  return validator.validateRequest({
    method: method.toUpperCase(),
    url: `http://localhost/api/v2${path}`,
    headers: new Headers({
      'content-type': method === 'patch' ? 'application/merge-patch+json' : 'application/json',
      'x-csrf-token': 'token',
      ...(method === 'post' ? {} : { 'if-match': '"idp1"' }),
    }),
    body,
  }).violations
}

describe('formFromDefaults', () => {
  it('starts with Keycloak, as legacy, and the capabilities defaults', () => {
    const form = formFromDefaults(capabilities)
    expect(form.type).toBe('keycloak')
    expect(form.port).toBe('389')
    expect(form.syncInterval).toBe('15')
    expect(form.createMailboxOnSignIn).toBe(true)
    expect(form.useSsl).toBe(false)
    expect(form.attributeMapping).toEqual([])
    expect(form.defaultTemplate).toBe('')
    expect(form.clientSecret).toBe('')
  })
})

describe('formFromConfig', () => {
  it('maps stored nulls to empty fields and hosts to one comma-separated field', () => {
    const form = formFromConfig(
      stored(storedLdap({ hosts: ['ldap1.example.org', '2001:db8::1'], filter: null })),
      capabilities,
    )
    expect(form.type).toBe('ldap')
    expect(form.hosts).toBe('ldap1.example.org, 2001:db8::1')
    expect(form.filter).toBe('')
    expect(form.bindPassword).toBe('')
    expect(form.attributeMapping).toEqual([{ attributeValue: 'staff', template: 'Staff' }])
  })

  it('keeps the other types at their defaults', () => {
    const form = formFromConfig(stored(storedKeycloak({ defaultTemplate: 'Staff' })), capabilities)
    expect(form.serverUrl).toBe('https://sso.example.org')
    expect(form.defaultTemplate).toBe('Staff')
    expect(form.port).toBe('389')
    expect(form.scopes).toBe('')
  })
})

describe('splitHosts', () => {
  it('splits on commas and drops empty entries, as legacy stores the field', () => {
    expect(splitHosts(' ldap1.example.org ,ldap2.example.org,, ')).toEqual([
      'ldap1.example.org',
      'ldap2.example.org',
    ])
  })
})

describe('toInput', () => {
  it('builds a contract-valid Keycloak save without read-only members', () => {
    const form = formFromDefaults(capabilities)
    Object.assign(form, {
      serverUrl: ' https://sso.example.org/ ',
      realm: 'example',
      clientId: 'mailcow',
      clientSecret: 'top-secret',
      version: '26.0.7',
      legacyReturnUrl: 'https://mail.example.org',
      additionalReturnUrls: ['https://webmail.example.org', ''],
      attributeMapping: [
        { attributeValue: ' staff ', template: 'Staff' },
        { attributeValue: '', template: '' },
      ],
    })
    const input = toInput(form, defaults)
    expect(input).toMatchObject({
      type: 'keycloak',
      serverUrl: 'https://sso.example.org/',
      clientSecret: 'top-secret',
      additionalReturnUrls: ['https://webmail.example.org'],
      attributeMapping: [{ attributeValue: 'staff', template: 'Staff' }],
      defaultTemplate: null,
      syncInterval: 15,
    })
    expect(input).not.toHaveProperty('hosts')
    expect(input).not.toHaveProperty('complete')
    expect(requestErrors('put', '/identity-provider', input)).toEqual([])
    expect(requestErrors('post', '/identity-provider/connection-tests', input)).toEqual([])
  })

  it('builds a generic OIDC save, with the default scopes when the field is empty', () => {
    const form = formFromDefaults(capabilities)
    Object.assign(form, {
      type: 'genericOidc',
      authorizationEndpoint: 'https://login.example.org/authorize',
      tokenEndpoint: 'https://login.example.org/token',
      userInfoEndpoint: 'https://login.example.org/userinfo',
      clientId: 'mailcow',
      clientSecret: 'x',
      legacyReturnUrl: 'https://mail.example.org',
    })
    const input = toInput(form, defaults)
    expect(input).toMatchObject({ type: 'genericOidc', scopes: defaults.scopes })
    expect(input).not.toHaveProperty('realm')
    expect(requestErrors('put', '/identity-provider', input)).toEqual([])
  })

  it('builds an LDAP save: hosts split, empty filter and attribute field as null, no secret when empty', () => {
    const form = formFromConfig(stored(storedLdap({ attributeField: null })), capabilities)
    form.hosts = 'ldap1.example.org, ldap2.example.org'
    const input = toInput(form, defaults)
    expect(input).toMatchObject({
      type: 'ldap',
      hosts: ['ldap1.example.org', 'ldap2.example.org'],
      port: 389,
      filter: null,
      attributeField: null,
      usernameField: 'mail',
    })
    expect(input).not.toHaveProperty('bindPassword')
    expect(requestErrors('put', '/identity-provider', input)).toEqual([])
  })
})

describe('toPatch', () => {
  it('sends only the changed members, arrays whole, and the secret only when typed', () => {
    const config = stored(storedLdap())
    const form = formFromConfig(config, capabilities)
    expect(toPatch(form, config, defaults)).toBeNull()
    form.syncInterval = '60'
    form.attributeMapping = [...form.attributeMapping, { attributeValue: 'it', template: 'Staff' }]
    const patch = toPatch(form, config, defaults)
    expect(patch).toEqual({
      syncInterval: 60,
      attributeMapping: [
        { attributeValue: 'staff', template: 'Staff' },
        { attributeValue: 'it', template: 'Staff' },
      ],
    })
    expect(requestErrors('patch', '/identity-provider', patch)).toEqual([])
    form.bindPassword = 'new'
    expect(toPatch(form, config, defaults)).toMatchObject({ bindPassword: 'new' })
  })

  it('clears an optional value with null', () => {
    const config = stored(storedGenericOidc({ defaultTemplate: 'Staff' }))
    const form = formFromConfig(config, capabilities)
    form.defaultTemplate = ''
    expect(toPatch(form, config, defaults)).toEqual({ defaultTemplate: null })
  })
})
