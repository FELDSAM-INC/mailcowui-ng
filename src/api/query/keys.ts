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
// UI 010 (data-model §3).
export type DkimListParams = NonNullable<operations['listDkimKeys']['parameters']['query']>
export type MtaStsListParams = NonNullable<operations['listMtaStsPolicies']['parameters']['query']>
// UI 009 (data-model §1, §3).
export type RelayhostListParams = NonNullable<operations['listRelayhosts']['parameters']['query']>
export type RelayhostUsageParams = NonNullable<
  operations['listRelayhostUsage']['parameters']['query']
>
export type RelayhostChoiceParams = NonNullable<
  operations['listRelayhostChoices']['parameters']['query']
>
export type TransportListParams = NonNullable<operations['listTransports']['parameters']['query']>
export type BccMapListParams = NonNullable<operations['listBccMaps']['parameters']['query']>
export type BccDestinationChoiceParams = NonNullable<
  operations['listBccDestinationChoices']['parameters']['query']
>
export type RecipientMapListParams = NonNullable<
  operations['listRecipientMaps']['parameters']['query']
>
export type TlsPolicyMapListParams = NonNullable<
  operations['listTlsPolicyMaps']['parameters']['query']
>
export type ForwardingHostListParams = NonNullable<
  operations['listForwardingHosts']['parameters']['query']
>

// UI 006 (data-model §3).
export type QuarantineListParams = NonNullable<
  operations['listQuarantineItems']['parameters']['query']
>
export type SpamPolicyEntryListParams = NonNullable<
  operations['listMailboxSpamPolicyEntries']['parameters']['query']
>
export type RateLimitListParams = NonNullable<operations['listRateLimits']['parameters']['query']>
export type SpamPolicyOwnerKind = 'domain' | 'aliasDomain' | 'mailbox'
export type RateLimitKind = SpamPolicyOwnerKind

export type Oauth2ClientListParams = NonNullable<
  operations['listOauth2Clients']['parameters']['query']
>

// UI 011 (data-model §3).
export type ContainerListParams = NonNullable<operations['listContainers']['parameters']['query']>
export type RspamdHistoryParams = NonNullable<
  operations['listRspamdHistory']['parameters']['query']
>
export type MailQueueListParams = NonNullable<
  operations['listMailQueueMessages']['parameters']['query']
>
export type Fail2BanActiveBanListParams = NonNullable<
  operations['listFail2BanActiveBans']['parameters']['query']
>
export type Fail2BanPermanentBanListParams = NonNullable<
  operations['listFail2BanPermanentBans']['parameters']['query']
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
  // UI 004 (data-model §3): the feature's capabilities, and one prefix per area.
  capabilities: {
    aliases: () => ['capabilities', 'aliases'] as const,
  },
  aliases: {
    all: () => ['aliases'] as const,
    lists: () => ['aliases', 'list'] as const,
    list: (params: AliasListParams) => ['aliases', 'list', params] as const,
    detail: (id: number) => ['aliases', 'detail', id] as const,
  },
  aliasDomains: {
    all: () => ['alias-domains'] as const,
    lists: () => ['alias-domains', 'list'] as const,
    list: (params: AliasDomainListParams) => ['alias-domains', 'list', params] as const,
    detail: (name: string) => ['alias-domains', 'detail', name] as const,
    /** The alias-domain group of the alias list's domain filter (searched, paged). */
    options: (q: string) => ['alias-domains', 'options', { q }] as const,
  },
  resources: {
    all: () => ['resources'] as const,
    lists: () => ['resources', 'list'] as const,
    list: (params: ResourceListParams) => ['resources', 'list', params] as const,
    detail: (address: string) => ['resources', 'detail', address] as const,
  },
  senderSettings: {
    all: () => ['sender-settings'] as const,
    detail: (mailbox: string) => ['sender-settings', 'detail', mailbox] as const,
  },
  senderPermissionCandidates: (params: {
    mailbox: string
    q: string
    type: SenderPermissionCandidateParams['type']
  }) => ['sender-permission-candidates', params] as const,
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
  // UI 010 (data-model §3): the DNS capabilities, DKIM entries, MTA-STS policies and the
  // diagnostics results with the rate limit and the "changed after this check" markers.
  dns: {
    capabilities: () => ['dns-capabilities'] as const,
  },
  dkimKeys: {
    all: () => ['dkim-keys'] as const,
    lists: () => ['dkim-keys', 'list'] as const,
    list: (params: DkimListParams) => ['dkim-keys', 'list', params] as const,
    details: () => ['dkim-keys', 'detail'] as const,
    detail: (name: string) => ['dkim-keys', 'detail', name] as const,
    copyTargetLists: () => ['dkim-keys', 'copy-targets'] as const,
    copyTargets: (q: string) => ['dkim-keys', 'copy-targets', { q }] as const,
    /** The publication outcome of the last change of a name, shown once on its entry page. */
    outcome: (name: string) => ['dkim-keys', 'outcome', name] as const,
  },
  mtaStsPolicies: {
    all: () => ['mta-sts-policies'] as const,
    lists: () => ['mta-sts-policies', 'list'] as const,
    list: (params: MtaStsListParams) => ['mta-sts-policies', 'list', params] as const,
    detail: (domain: string) => ['mta-sts-policies', 'detail', domain] as const,
  },
  dnsDiagnostics: {
    all: () => ['dns-diagnostics'] as const,
    result: (name: string) => ['dns-diagnostics', 'result', name] as const,
    rateLimit: () => ['dns-diagnostics', 'rate-limit'] as const,
    changed: (name: string) => ['dns-diagnostics', 'changed', name] as const,
  },
  // UI 009 (data-model §3): one root per routing collection.
  routingCapabilities: () => ['routing-capabilities'] as const,
  relayhosts: {
    all: () => ['relayhosts'] as const,
    lists: () => ['relayhosts', 'list'] as const,
    list: (params: RelayhostListParams) => ['relayhosts', 'list', params] as const,
    details: () => ['relayhosts', 'detail'] as const,
    detail: (id: number) => ['relayhosts', 'detail', id] as const,
    usages: () => ['relayhosts', 'usage'] as const,
    usage: (id: number, params: RelayhostUsageParams) =>
      ['relayhosts', 'usage', id, params] as const,
  },
  relayhostChoices: {
    all: () => ['relayhost-choices'] as const,
    search: (q: string) => ['relayhost-choices', { q }] as const,
  },
  relayhostAssignments: {
    all: () => ['relayhost-assignments'] as const,
    domains: () => ['relayhost-assignments', 'domain'] as const,
    domain: (name: string) => ['relayhost-assignments', 'domain', name.toLowerCase()] as const,
    mailboxes: () => ['relayhost-assignments', 'mailbox'] as const,
    mailbox: (address: string) =>
      ['relayhost-assignments', 'mailbox', address.toLowerCase()] as const,
  },
  transports: {
    all: () => ['transports'] as const,
    lists: () => ['transports', 'list'] as const,
    list: (params: TransportListParams) => ['transports', 'list', params] as const,
    detail: (id: number) => ['transports', 'detail', id] as const,
  },
  bccMaps: {
    all: () => ['bcc-maps'] as const,
    lists: () => ['bcc-maps', 'list'] as const,
    list: (params: BccMapListParams) => ['bcc-maps', 'list', params] as const,
    detail: (id: number) => ['bcc-maps', 'detail', id] as const,
  },
  bccDestinationChoices: {
    all: () => ['bcc-destination-choices'] as const,
    search: (params: Omit<BccDestinationChoiceParams, 'limit' | 'offset'>) =>
      ['bcc-destination-choices', params] as const,
  },
  recipientMaps: {
    all: () => ['recipient-maps'] as const,
    lists: () => ['recipient-maps', 'list'] as const,
    list: (params: RecipientMapListParams) => ['recipient-maps', 'list', params] as const,
    detail: (id: number) => ['recipient-maps', 'detail', id] as const,
  },
  tlsPolicyMaps: {
    all: () => ['tls-policy-maps'] as const,
    lists: () => ['tls-policy-maps', 'list'] as const,
    list: (params: TlsPolicyMapListParams) => ['tls-policy-maps', 'list', params] as const,
    detail: (id: number) => ['tls-policy-maps', 'detail', id] as const,
  },
  forwardingHosts: {
    all: () => ['forwarding-hosts'] as const,
    lists: () => ['forwarding-hosts', 'list'] as const,
    list: (params: ForwardingHostListParams) => ['forwarding-hosts', 'list', params] as const,
  },
  // UI 006 (data-model §3): the quarantine, the spam policy (score, lists, statistics) and the
  // rate limits, each under its own root. Mailbox names are lower-cased like UI 003's keys.
  quarantine: {
    all: () => ['quarantine'] as const,
    capabilities: () => ['quarantine', 'capabilities'] as const,
    settings: () => ['quarantine', 'settings'] as const,
    lists: () => ['quarantine', 'list'] as const,
    list: (params: QuarantineListParams) => ['quarantine', 'list', params] as const,
    details: () => ['quarantine', 'detail'] as const,
    detail: (itemId: number) => ['quarantine', 'detail', itemId] as const,
    notificationSettingsAll: () => ['quarantine', 'notification-settings'] as const,
    notificationSettings: (mailbox: string) =>
      ['quarantine', 'notification-settings', mailbox.toLowerCase()] as const,
  },
  spamPolicy: {
    all: () => ['spam-policy'] as const,
    spamScore: (mailbox: string) => ['spam-policy', 'spam-score', mailbox.toLowerCase()] as const,
    entriesAll: () => ['spam-policy', 'entries'] as const,
    ownerEntries: (kind: SpamPolicyOwnerKind, owner: string) =>
      ['spam-policy', 'entries', kind, owner.toLowerCase()] as const,
    entries: (kind: SpamPolicyOwnerKind, owner: string, params: SpamPolicyEntryListParams) =>
      ['spam-policy', 'entries', kind, owner.toLowerCase(), params] as const,
    statistics: () => ['spam-policy', 'statistics'] as const,
  },
  rateLimits: {
    all: () => ['rate-limits'] as const,
    lists: () => ['rate-limits', 'list'] as const,
    list: (params: RateLimitListParams) => ['rate-limits', 'list', params] as const,
    details: () => ['rate-limits', 'detail'] as const,
    kindDetails: (kind: RateLimitKind) => ['rate-limits', 'detail', kind] as const,
    detail: (kind: RateLimitKind, object: string) =>
      ['rate-limits', 'detail', kind, object.toLowerCase()] as const,
  },
}
