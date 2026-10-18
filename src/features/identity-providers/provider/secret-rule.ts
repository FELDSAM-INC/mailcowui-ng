// When the secret of the identity provider form is required (FR-024, FR-025): always when nothing
// of the form's type is stored (or the stored one has no secret), when the type changes, and when
// the address that receives the secret changes (Keycloak server URL, generic OIDC token endpoint,
// LDAP hosts in order), because the stored secret would otherwise be sent to a new address.
// Otherwise an empty secret keeps the stored one. The reasons are the API's `secretRequired`
// reasons, so the client and the server explain it with the same message.
import type { IdentityProvider } from '@/api'

import { splitHosts, type ProviderForm } from './form-model'

export type SecretRequirement = 'noStoredSecret' | 'typeChanged' | 'addressChanged' | null

const url = (value: string | null | undefined) => (value ?? '').trim().replace(/\/+$/, '')

export function secretRequirement(
  form: ProviderForm,
  config: IdentityProvider | null | undefined,
): SecretRequirement {
  if (!config) return 'noStoredSecret'
  if (config.type !== form.type) return 'typeChanged'
  switch (config.type) {
    case 'keycloak':
      if (!config.clientSecretSet) return 'noStoredSecret'
      return url(form.serverUrl) === url(config.serverUrl) ? null : 'addressChanged'
    case 'genericOidc':
      if (!config.clientSecretSet) return 'noStoredSecret'
      return form.tokenEndpoint.trim() === (config.tokenEndpoint ?? '') ? null : 'addressChanged'
    case 'ldap':
      if (!config.bindPasswordSet) return 'noStoredSecret'
      return JSON.stringify(splitHosts(form.hosts)) === JSON.stringify(config.hosts)
        ? null
        : 'addressChanged'
  }
}
