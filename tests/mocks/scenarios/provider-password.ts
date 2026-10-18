// Password sign-in of LDAP and Keycloak mailboxes (UI 012 T060, research R24). carl@example.org is
// an LDAP mailbox and dave@example.org a Keycloak mailbox of the mailpassword flow; both sign in
// with MOCK_PASSWORD through UI 001's password form.
import type { ScenarioDefinition, ScenarioOverrides } from './index'
import { totp } from './accounts'

export const LDAP_USER = 'carl@example.org'
export const KEYCLOAK_USER = 'dave@example.org'

const ldap = (extra: ScenarioOverrides = {}): ScenarioOverrides => ({
  publicConfig: 'identity-provider',
  accounts: { [LDAP_USER]: { role: 'mailboxUser', source: 'ldap' } },
  ...extra,
})

export const providerPasswordScenarios: Record<string, ScenarioDefinition> = {
  'ldap-password': {
    description: 'An LDAP provider is configured; carl@example.org signs in with his password.',
    overrides: ldap(),
  },
  'ldap-password-totp': {
    description: 'carl@example.org (LDAP) has an authenticator app (code 123456).',
    overrides: ldap({
      accounts: {
        [LDAP_USER]: { role: 'mailboxUser', source: 'ldap', secondFactors: [totp(51, 'Phone')] },
      },
    }),
  },
  'ldap-provider-down': {
    description: 'The LDAP directory cannot be reached.',
    overrides: ldap({ singleSignOn: { providerOutage: true } }),
  },
  'keycloak-password-forced-2fa': {
    description:
      'dave@example.org (Keycloak, mailpassword flow) must set up a second factor: his template forces it.',
    overrides: {
      publicConfig: 'identity-provider',
      accounts: {
        [KEYCLOAK_USER]: {
          role: 'mailboxUser',
          source: 'keycloak',
          pendingActions: ['secondFactorSetup'],
        },
      },
    },
  },
  'ldap-throttled': {
    description: 'carl@example.org (LDAP); every sign-in is refused as too many requests.',
    overrides: ldap({ behaviour: { throttleThreshold: 0, retryAfter: 90 } }),
  },
}
