// The typed query key factory (data-model §3). Later features add their own roots here, for
// example `domains` (UI 002). List parameter types are aliases of the generated operation
// parameters.
import type { operations } from '../generated/schema'

export type PasskeyListParams = NonNullable<operations['listPasskeys']['parameters']['query']>
export type ApiKeyListParams = NonNullable<operations['listApiKeys']['parameters']['query']>
export type ApiKeyOwnerCandidateParams = NonNullable<
  operations['listApiKeyOwnerCandidates']['parameters']['query']
>
export type AuditListParams = NonNullable<operations['listAuditEvents']['parameters']['query']>
export type DomainListParams = NonNullable<operations['listDomains']['parameters']['query']>
export type DomainTagParams = NonNullable<operations['listDomainTags']['parameters']['query']>
export type TemplateListParams = NonNullable<
  operations['listDomainTemplates']['parameters']['query']
>

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
  // UI 002 (data-model §3): one `domains` prefix invalidates everything that depends on domains.
  domains: {
    all: () => ['domains'] as const,
    lists: () => ['domains', 'list'] as const,
    list: (params: DomainListParams) => ['domains', 'list', params] as const,
    details: () => ['domains', 'detail'] as const,
    detail: (name: string) => ['domains', 'detail', name] as const,
    footer: (name: string) => ['domains', 'footer', name] as const,
    deletionPreview: (name: string) => ['domains', 'deletion-preview', name] as const,
    capabilities: () => ['domains', 'capabilities'] as const,
    tagLists: () => ['domains', 'tags'] as const,
    tags: (params: DomainTagParams) => ['domains', 'tags', params] as const,
    creationReport: (name: string) => ['domains', 'creation-report', name] as const,
    exclusionCandidates: (name: string, q: string) =>
      ['domains', 'exclusion-candidates', name, q] as const,
  },
  domainTemplates: {
    all: () => ['domain-templates'] as const,
    lists: () => ['domain-templates', 'list'] as const,
    list: (params: TemplateListParams) => ['domain-templates', 'list', params] as const,
    detail: (id: number) => ['domain-templates', 'detail', id] as const,
  },
}
