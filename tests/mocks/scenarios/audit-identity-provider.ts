// Audit records of API 012 (UI 012 US6 T089, research R24): identity provider changes, a failed
// connection test, a refused removal, every OAuth2 client event, sign-ins through the provider with
// every API 012 failure reason, and a single sign-on session end. Times are relative to the moment
// the scenario is created, so the audit log's default range always finds them.
import {
  AUDIT_OAUTH2_CLIENT,
  identityProviderAuditRecords,
} from '../factories/audit-identity-provider'
import { mockOauth2Client } from '../factories/oauth2-client'
import type { ScenarioDefinition } from './index'

export const auditIdentityProviderScenarios: Record<string, ScenarioDefinition> = {
  'audit-identity-provider': {
    description:
      'admin is signed in; audit records of the identity provider, of OAuth2 client 4 and of sign-ins through the provider',
    setup: (state) => {
      state.auditEvents = identityProviderAuditRecords(Date.now())
      state.oauth2Clients = [
        mockOauth2Client({
          id: AUDIT_OAUTH2_CLIENT.id,
          clientId: AUDIT_OAUTH2_CLIENT.clientId,
          redirectUris: ['https://wiki.example.org/oauth/callback', 'https://wiki.example.org/cb2'],
        }),
      ]
    },
    overrides: { signedInAs: 'admin' },
  },
}
