// The typed query key factory (data-model §3). Later features add their own roots here, for
// example `domains`. List parameter types are aliases of the generated operation parameters.
import type { operations } from '../generated/schema'

export type PasskeyListParams = NonNullable<operations['listPasskeys']['parameters']['query']>
export type ApiKeyListParams = NonNullable<operations['listApiKeys']['parameters']['query']>
export type ApiKeyOwnerCandidateParams = NonNullable<
  operations['listApiKeyOwnerCandidates']['parameters']['query']
>
export type AuditListParams = NonNullable<operations['listAuditEvents']['parameters']['query']>

export const queryKeys = {
  publicConfig: () => ['public-config'] as const,
  session: () => ['session'] as const,
  identity: () => ['identity'] as const,
  passkeys: {
    all: () => ['passkeys'] as const,
    list: (params: PasskeyListParams) => ['passkeys', 'list', params] as const,
  },
  apiKeys: {
    all: () => ['api-keys'] as const,
    lists: () => ['api-keys', 'list'] as const,
    list: (params: ApiKeyListParams) => ['api-keys', 'list', params] as const,
    detail: (apiKeyId: string) => ['api-keys', 'detail', apiKeyId] as const,
    ownerCandidates: (params: ApiKeyOwnerCandidateParams) =>
      ['api-keys', 'owner-candidates', params] as const,
  },
  auditEvents: {
    all: () => ['audit-events'] as const,
    list: (params: AuditListParams) => ['audit-events', 'list', params] as const,
  },
}
