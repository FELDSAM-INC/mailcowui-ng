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
// UI 004 (data-model §1).
export type AliasListParams = NonNullable<operations['listAliases']['parameters']['query']>
export type AliasDomainListParams = NonNullable<
  operations['listAliasDomains']['parameters']['query']
>
export type ResourceListParams = NonNullable<operations['listResources']['parameters']['query']>
export type SenderPermissionCandidateParams = NonNullable<
  operations['listSenderPermissionCandidates']['parameters']['query']
>
// UI 003 (data-model §1).
export type MailboxListParams = NonNullable<operations['listMailboxes']['parameters']['query']>
export type MailboxTagParams = NonNullable<operations['listMailboxTags']['parameters']['query']>
export type MailboxTemplateListParams = NonNullable<
  operations['listMailboxTemplates']['parameters']['query']
>
export type SyncJobListParams = NonNullable<operations['listSyncJobs']['parameters']['query']>

export type Oauth2ClientListParams = NonNullable<
  operations['listOauth2Clients']['parameters']['query']
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
  // UI 008 (data-model §3).
  syncJobs: {
    all: () => ['sync-jobs'] as const,
    lists: () => ['sync-jobs', 'list'] as const,
    list: (params: SyncJobListParams) => ['sync-jobs', 'list', params] as const,
    details: () => ['sync-jobs', 'detail'] as const,
    detail: (id: number) => ['sync-jobs', 'detail', id] as const,
    log: (id: number) => ['sync-jobs', 'log', id] as const,
    capabilities: () => ['sync-jobs', 'capabilities'] as const,
  },
  domainTemplates: {
    all: () => ['domain-templates'] as const,
    lists: () => ['domain-templates', 'list'] as const,
    list: (params: TemplateListParams) => ['domain-templates', 'list', params] as const,
    detail: (id: number) => ['domain-templates', 'detail', id] as const,
  },
  // UI 003 (data-model §3): one `mailboxes` prefix invalidates everything that depends on
  // mailboxes; templates and the password policy have their own roots.
  mailboxes: {
    all: () => ['mailboxes'] as const,
    lists: () => ['mailboxes', 'list'] as const,
    list: (params: MailboxListParams) => ['mailboxes', 'list', params] as const,
    details: () => ['mailboxes', 'detail'] as const,
    detail: (address: string) => ['mailboxes', 'detail', address.toLowerCase()] as const,
    deletionPreview: (address: string) =>
      ['mailboxes', 'deletion-preview', address.toLowerCase()] as const,
    capabilities: () => ['mailboxes', 'capabilities'] as const,
    tagLists: () => ['mailboxes', 'tags'] as const,
    tags: (params: MailboxTagParams) => ['mailboxes', 'tags', params] as const,
    /** The searches of `MailboxSearchPicker` (shared, used by UI 004 and UI 008). */
    searches: () => ['mailboxes', 'search'] as const,
    search: (params: MailboxListParams) => ['mailboxes', 'search', params] as const,
  },
  mailboxTemplates: {
    all: () => ['mailbox-templates'] as const,
    lists: () => ['mailbox-templates', 'list'] as const,
    list: (params: MailboxTemplateListParams) => ['mailbox-templates', 'list', params] as const,
    everything: () => ['mailbox-templates', 'all'] as const,
    detail: (id: number) => ['mailbox-templates', 'detail', id] as const,
  },
  passwordPolicy: () => ['password-policy'] as const,
  identityProvider: {
    all: () => ['identity-provider'] as const,
    capabilities: () => ['identity-provider', 'capabilities'] as const,
    configuration: () => ['identity-provider', 'configuration'] as const,
  },
  oauth2Clients: {
    all: () => ['oauth2-clients'] as const,
    capabilities: () => ['oauth2-clients', 'capabilities'] as const,
    lists: () => ['oauth2-clients', 'list'] as const,
    list: (params: Oauth2ClientListParams) => ['oauth2-clients', 'list', params] as const,
    detail: (id: number) => ['oauth2-clients', 'detail', id] as const,
  },
}
