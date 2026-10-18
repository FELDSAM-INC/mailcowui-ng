// Field limits of the pinned contract (data-model §6). API feature 001 has no capabilities read, so
// the values live here, each next to the schema path it comes from. limits.spec.ts compares every
// constant with contract/openapi.json, so a contract bump cannot leave one stale.

/** PasswordSignInRequest.properties.username.maxLength */
export const USERNAME_MAX_LENGTH = 255

/** PasswordSignInRequest.properties.password.maxLength */
export const PASSWORD_MAX_LENGTH = 4096

/** PasskeyPatch.properties.name.maxLength and PasskeyRegistrationRequest.properties.name.maxLength */
export const PASSKEY_NAME_MAX_LENGTH = 255

/** ApiKeyCreateRequest.properties.name.maxLength */
export const API_KEY_NAME_MAX_LENGTH = 255

/** ApiKeyCreateRequest.properties.ownerUsername.maxLength and the listApiKeys `ownerUsername` filter */
export const API_KEY_OWNER_MAX_LENGTH = 255

/** ApiKeyCreateRequest.properties.allowedNetworks.maxItems */
export const ALLOWED_NETWORKS_MAX_ITEMS = 100

/** ApiKeyCreateRequest.properties.allowedNetworks.items.maxLength */
export const NETWORK_MAX_LENGTH = 49

/** listAuditEvents query parameter `eventType` maxItems */
export const AUDIT_EVENT_TYPES_MAX_ITEMS = 20

/** listAuditEvents query parameter `actor` maxLength */
export const AUDIT_ACTOR_MAX_LENGTH = 255

/** listAuditEvents query parameter `clientAddress` maxLength */
export const AUDIT_ADDRESS_MAX_LENGTH = 49

// UI 002 (T021): domains, templates, footers and the audit target.

/** listDomains query parameter `tag` maxItems */
export const DOMAIN_TAG_FILTER_MAX_ITEMS = 100

/** listDomains query parameter `tag` items maxLength, and DomainTagList.items.maxLength */
export const DOMAIN_TAG_MAX_LENGTH = 255

/** DomainCreateRequest.properties.maxMailboxes.minimum (and maxAliases) */
export const DOMAIN_LIMIT_MIN = 0

/** DomainCreateRequest.properties.maxMailboxes.maximum (and maxAliases) */
export const DOMAIN_LIMIT_MAX = 2_147_483_647

/** DomainRateLimit.properties.value.minimum */
export const RATE_LIMIT_MIN = 1

/** DomainRateLimit.properties.value.maximum */
export const RATE_LIMIT_MAX = 2_147_483_647

/** DomainCreateRequest.properties.domainQuota.maximum (bytes; the same for every quota) */
export const QUOTA_MAX_BYTES = 9_007_199_254_740_992

/** DomainTemplateCreateRequest.properties.name.maxLength */
export const TEMPLATE_NAME_MAX_LENGTH = 255

/** DomainCreateRequest.properties.dkimSelector.maxLength */
export const DKIM_SELECTOR_MAX_LENGTH = 255

/** DomainFooterReplace.properties.excludedAddresses.items.maxLength (and excludedAliasDomains) */
export const FOOTER_EXCLUSION_MAX_LENGTH = 255

/** The `q` search parameter (`Search`) maxLength */
export const SEARCH_MAX_LENGTH = 255

/** listAuditEvents query parameter `targetId` maxLength */
export const AUDIT_TARGET_ID_MAX_LENGTH = 255
