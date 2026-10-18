// Stored identity provider configurations as the client reads them, from the mock factories (the
// mock builds plain JSON; the client's type has read-only members as plain values).
import type { IdentityProviderConfig } from '@/features/identity-providers/provider/types'

import {
  identityProviderCapabilities,
  identityProviderView,
  initialIdentityProvider,
  type MockIdentityProvider,
  type StoredIdentityProvider,
} from '../../../../mocks/factories/identity-provider'

export const capabilities = identityProviderCapabilities(initialIdentityProvider())

/** A stored configuration with both secrets set, unless `state` says otherwise. */
export function configOf(
  stored: StoredIdentityProvider,
  templates: readonly string[] = ['Staff'],
  state: Partial<MockIdentityProvider> = {},
): IdentityProviderConfig {
  return identityProviderView(
    { ...initialIdentityProvider(), stored, clientSecret: 's', bindPassword: 'p', ...state },
    templates,
  ) as unknown as IdentityProviderConfig
}
