// The UI 012 mock factories produce contract-valid data (T010, research R24): the identity
// provider capabilities and representations of each type, connection test results, OAuth2
// clients and mailbox templates.
import { describe, expect, it } from 'vitest'

import { contractValidator } from '../../mocks/contract/validator'
import {
  connectionTestResult,
  identityProviderCapabilities,
  identityProviderView,
  initialIdentityProvider,
  missingSettings,
  storedGenericOidc,
  storedKeycloak,
  storedLdap,
} from '../../mocks/factories/identity-provider'
import { mailboxTemplateView } from '../../mocks/factories/mailbox-template'
import {
  mockOauth2Client,
  OAUTH2_CAPABILITIES,
  oauth2ClientView,
} from '../../mocks/factories/oauth2-client'

const validator = contractValidator()
const schema = (name: string) => `#/components/schemas/${name}`

describe('UI 012 mock factories', () => {
  it('build contract-valid capabilities, with and without a configuration', () => {
    const state = initialIdentityProvider()
    expect(
      validator.validateSchema(
        schema('IdentityProviderCapabilities'),
        identityProviderCapabilities(state),
      ),
    ).toEqual([])
    state.stored = storedLdap()
    const capabilities = identityProviderCapabilities(state)
    expect(capabilities.configuredType).toBe('ldap')
    expect(capabilities.defaults.syncInterval).toBe(15)
    expect(capabilities.limits.ldapHostsMaxEntries).toBe(10)
  })

  it.each([
    ['keycloak', storedKeycloak()],
    ['genericOidc', storedGenericOidc()],
    ['ldap', storedLdap({ useSsl: true })],
  ] as const)('build a contract-valid %s representation', (type, stored) => {
    const state = { ...initialIdentityProvider(), stored, clientSecret: 's', bindPassword: 'p' }
    const view = identityProviderView(state, ['Staff'])
    expect(view.type).toBe(type)
    expect(view.complete).toBe(true)
    expect(validator.validateSchema(schema('IdentityProvider'), view)).toEqual([])
    if (view.type === 'ldap') expect(view.effectivePort).toBe(636)
  })

  it('reports missing settings and missing templates', () => {
    const state = {
      ...initialIdentityProvider(),
      stored: storedKeycloak({ realm: null, defaultTemplate: 'Gone' }),
    }
    expect(missingSettings(state)).toEqual(['realm', 'clientSecret'])
    const view = identityProviderView(state, [])
    expect(view.complete).toBe(false)
    expect(view.defaultTemplateExists).toBe(false)
    expect(validator.validateSchema(schema('IdentityProvider'), view)).toEqual([])
  })

  it('build contract-valid connection test results', () => {
    for (const outcome of [
      'success',
      'unreachable',
      'timedOut',
      'tlsCertificateRejected',
      'credentialsRejected',
      'unexpectedResponse',
    ] as const) {
      expect(
        validator.validateSchema(
          schema('IdentityProviderConnectionTestResult'),
          connectionTestResult(
            'ldap',
            'ldap://ldap1.example.org:389',
            outcome,
            '2026-10-19T08:00:00Z',
          ),
        ),
        outcome,
      ).toEqual([])
    }
  })

  it('build contract-valid OAuth2 clients, capabilities and mailbox templates', () => {
    const client = mockOauth2Client({ id: 7 })
    expect(client.clientId).toMatch(/^[0-9a-f]{12}$/)
    expect(client.clientSecret).toMatch(/^[0-9a-f]{24}$/)
    expect(validator.validateSchema(schema('Oauth2Client'), oauth2ClientView(client))).toEqual([])
    expect(oauth2ClientView(client)).not.toHaveProperty('clientSecret')
    expect(
      validator.validateSchema(schema('Oauth2ClientCapabilities'), OAUTH2_CAPABILITIES),
    ).toEqual([])
    expect(
      validator.validateSchema(schema('MailboxTemplate'), mailboxTemplateView('Staff', 2)),
    ).toEqual([])
  })
})
