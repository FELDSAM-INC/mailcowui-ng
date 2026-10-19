// Identity provider scenarios (UI 012 T016, T066, research R24). Every one is an active
// administrator session; the configuration, the counts, the templates and the test outcome vary.
import {
  storedGenericOidc,
  storedKeycloak,
  storedLdap,
  type MockIdentityProvider,
} from '../factories/identity-provider'
import type { ScenarioDefinition } from './index'

/** UI 003's Default template is always there; the scenarios add Students and Staff. */
const TEMPLATES = { add: [{ name: 'Students' }, { name: 'Staff' }] }
const MODIFIED = '2026-10-12T08:30:00Z'

function admin(
  description: string,
  identityProvider: Partial<MockIdentityProvider> = {},
  extra: Omit<NonNullable<ScenarioDefinition['overrides']>, 'identityProvider'> = {},
): ScenarioDefinition {
  return {
    description,
    overrides: {
      signedInAs: 'admin',
      mailboxTemplates: TEMPLATES,
      identityProvider: {
        modifiedAt: identityProvider.stored ? MODIFIED : null,
        ...identityProvider,
      },
      ...extra,
    },
  }
}

export const identityProviderScenarios: Record<string, ScenarioDefinition> = {
  'idp-none': admin('admin, no identity provider, the templates Students and Staff'),
  'idp-no-templates': admin(
    'admin, no identity provider, no mailbox template but Default',
    {},
    {
      mailboxTemplates: {},
    },
  ),
  'idp-templates-fail': admin(
    'admin, no identity provider, the template list fails',
    {},
    {
      failures: { listMailboxTemplates: { status: 500 } },
    },
  ),
  'idp-ldap': admin('admin, a complete LDAP configuration, no mailbox uses it', {
    stored: storedLdap(),
    bindPassword: 'ldap-secret',
  }),
  'idp-keycloak': admin('admin, a complete Keycloak configuration with the mailpassword flow', {
    stored: storedKeycloak({
      mailpasswordFlow: true,
      additionalReturnUrls: ['https://webmail.example.org'],
      attributeMapping: [{ attributeValue: 'students', template: 'Students' }],
    }),
    clientSecret: 'kc-secret',
  }),
  'idp-oidc': admin('admin, a complete generic OIDC configuration', {
    stored: storedGenericOidc({ defaultTemplate: 'Staff' }),
    clientSecret: 'oidc-secret',
  }),
  'idp-ldap-in-use': admin('admin, LDAP used by 340 mailboxes', {
    stored: storedLdap(),
    bindPassword: 'ldap-secret',
    mailboxCounts: { keycloak: 0, genericOidc: 0, ldap: 340 },
  }),
  'idp-other-source': admin('admin, LDAP configured, 3 generic OIDC mailboxes remain', {
    stored: storedLdap(),
    bindPassword: 'ldap-secret',
    mailboxCounts: { keycloak: 0, genericOidc: 3, ldap: 0 },
  }),
  'idp-incomplete': admin(
    'admin, Keycloak stored by the classic interface without realm and secret',
    {
      stored: storedKeycloak({ realm: null }),
    },
  ),
  'idp-template-missing': admin('admin, LDAP whose mapping names a template that is gone', {
    stored: storedLdap({
      attributeMapping: [
        { attributeValue: 'staff', template: 'Staff' },
        { attributeValue: 'alumni', template: 'Alumni' },
      ],
    }),
    bindPassword: 'ldap-secret',
  }),
  'idp-changed-elsewhere': admin('admin, LDAP; the next write finds a newer version', {
    stored: storedLdap(),
    bindPassword: 'ldap-secret',
    rotateEtagOnNextWrite: true,
  }),
  'idp-removed-elsewhere': admin('admin, LDAP; the next write finds it removed', {
    stored: storedLdap(),
    bindPassword: 'ldap-secret',
    removedElsewhere: true,
  }),
}
