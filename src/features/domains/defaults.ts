// The documented default values (UI 002 research D18, FR-052), for a new template and for a
// creation without any template. The forms take them from `DomainCapabilities.templateDefaults`
// (API gap G29), which the contract returns to administrators only and marks optional; these are
// the fallback when it is absent. defaults.spec.ts checks each value against the `default`
// keywords of DomainTemplateCreateRequest and the description of DomainCreateRequest. The DKIM
// selector and key size come from the capabilities.
const MIB = 1_048_576

export const DOMAIN_DEFAULTS = {
  /** "10 mailboxes" */
  maxMailboxes: 10,
  /** "400 aliases" */
  maxAliases: 400,
  /** "10,240 MiB maximum mailbox quota" */
  maxMailboxQuota: 10240 * MIB,
  /** "10,240 MiB domain quota" */
  domainQuota: 10240 * MIB,
  /** "active" */
  active: true,
  /** "Global Address List on" */
  globalAddressList: true,
  /** "no relay options" */
  backupMx: false,
  relayAllRecipients: false,
  relayUnknownOnly: false,
  /** "no tags" */
  tags: [] as string[],
  /** "no rate limit" */
  rateLimit: null,
}
