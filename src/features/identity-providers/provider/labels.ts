// Texts of the identity provider's enumerations (UI 012, legacy form map): the type options, which
// legacy hard-codes (`Keycloak`, `Generic-OIDC`, `LDAP`), and the connection test's failure
// categories, which legacy cannot report. `npm run i18n:check` requires a text for every value
// (`src/i18n/coverage.json`, `complete`).
import type { IdentityProviderConnectionTestResult, IdentityProviderType } from '@/api'

export const typeLabelKey = (type: IdentityProviderType): string => `identityProvider.type.${type}`

export const failureLabelKey = (
  category: NonNullable<IdentityProviderConnectionTestResult['failureCategory']>,
): string => `identityProvider.test.failure.${category}`
