// Single sign-on scenarios (UI 012 T040, research R24). anna@example.org is a Keycloak mailbox
// (or a generic OIDC one); the fake provider of the end-to-end fixture returns to the app.
import type { PublicConfig } from '@/api'

import type { ScenarioDefinition, ScenarioOverrides } from './index'

const LOGIN_PAGE: PublicConfig['loginPage'] = {
  hideAdminLogin: false,
  hideDomainAdminLogin: false,
  hideMailboxUserLogin: false,
  forceSingleSignOn: false,
}

const config = (
  singleSignOnAvailable: boolean,
  options: { configured?: boolean; force?: boolean } = {},
): Partial<PublicConfig> => ({
  externalIdentityProvider: {
    configured: options.configured ?? true,
    singleSignOnAvailable,
  },
  loginPage: { ...LOGIN_PAGE, forceSingleSignOn: options.force ?? false },
})

const anna = { 'anna@example.org': { role: 'mailboxUser' as const, source: 'keycloak' as const } }

const available = (extra: ScenarioOverrides = {}): ScenarioOverrides => ({
  publicConfig: config(true),
  accounts: anna,
  ...extra,
})

export const SSO_USER = 'anna@example.org'

export const singleSignOnScenarios: Record<string, ScenarioDefinition> = {
  'sso-available': {
    description:
      'Single sign-on through Keycloak is offered; anna@example.org is a Keycloak mailbox.',
    overrides: available(),
  },
  'sso-available-oidc': {
    description: 'Single sign-on through a generic OIDC provider is offered.',
    overrides: available({
      accounts: { [SSO_USER]: { role: 'mailboxUser', source: 'genericOidc' } },
      singleSignOn: { provider: 'genericOidc' },
    }),
  },
  'sso-force': {
    description: 'Single sign-on is offered and the operator forces it.',
    overrides: available({ publicConfig: config(true, { force: true }) }),
  },
  'sso-force-ldap': {
    description: 'The operator forces single sign-on, but only LDAP is configured (not offered).',
    overrides: { publicConfig: config(false, { force: true }) },
  },
  'sso-force-none': {
    description: 'The operator forces single sign-on, but no identity provider is configured.',
    overrides: { publicConfig: config(false, { configured: false, force: true }) },
  },
  'sso-auto-create': {
    description:
      'Single sign-on is offered; the mailbox of the provider user is created at sign-in.',
    overrides: {
      publicConfig: config(true),
      singleSignOn: { username: 'new.user@example.org' },
    },
  },
  'sso-refused': {
    description: 'The completion is refused (no matching mailbox): one generic message.',
    overrides: available({ singleSignOn: { completion: 'refused' } }),
  },
  'sso-provider-down': {
    description: 'The provider cannot be reached when the sign-in is completed.',
    overrides: available({ singleSignOn: { completion: 'unavailable' } }),
  },
  'sso-disabled-after-start': {
    description: 'Single sign-on was switched off while the user was at the provider.',
    overrides: available({ singleSignOn: { completion: 'notAvailable' } }),
  },
  'sso-not-available-on-start': {
    description: 'The public configuration still offers single sign-on, but the start is refused.',
    overrides: available({ singleSignOn: { startNotAvailable: true } }),
  },
  'sso-signed-in': {
    description: 'anna@example.org is signed in through single sign-on.',
    overrides: available({ signedInAs: SSO_USER, session: { authMethod: 'singleSignOn' } }),
  },
  'sso-session-ends': {
    description:
      'anna@example.org is signed in through single sign-on; tests end the provider session.',
    overrides: available({ signedInAs: SSO_USER, session: { authMethod: 'singleSignOn' } }),
  },
}
