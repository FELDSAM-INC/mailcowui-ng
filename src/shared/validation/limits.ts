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

// UI 003 (T021): mailbox schema limits.

/** Mailbox.properties.address.maxLength (the full address) */
export const MAILBOX_ADDRESS_MAX = 255

/** Mailbox.properties.displayName.maxLength */
export const MAILBOX_DISPLAY_NAME_MAX = 255

/** MailboxCreateRequest.properties.password.maxLength (and MailboxPatch) */
export const MAILBOX_PASSWORD_MAX = 255

/** MailboxTemplate.properties.name.maxLength */
export const MAILBOX_TEMPLATE_NAME_MAX = 255

/** MailboxRateLimit.properties.value.minimum */
export const MAILBOX_RATE_LIMIT_MIN = 1

/** MailboxRateLimit.properties.value.maximum */
export const MAILBOX_RATE_LIMIT_MAX = 2_147_483_647

/** MailboxPatch.properties.recoveryEmail.oneOf[0].maxLength */
export const MAILBOX_RECOVERY_EMAIL_MAX = 255

// UI 012 (T012): identity provider, single sign-on and OAuth2 client fields that the identity
// provider and OAuth2 capabilities reads do not carry.

/** IdentityProviderKeycloakInput realm.maxLength */
export const KEYCLOAK_REALM_MAX_LENGTH = 255

/** IdentityProviderKeycloakInput and IdentityProviderGenericOidcInput clientId.maxLength */
export const PROVIDER_CLIENT_ID_MAX_LENGTH = 255

/** IdentityProviderKeycloakInput version.maxLength */
export const KEYCLOAK_VERSION_MAX_LENGTH = 64

/** IdentityProviderKeycloakInput version.pattern */
export const KEYCLOAK_VERSION_PATTERN = /^[0-9]+(\.[0-9]+){0,3}$/

/** IdentityProviderLdapInput hosts.items.maxLength */
export const LDAP_HOST_MAX_LENGTH = 253

/** IdentityProviderLdapInput port.minimum */
export const LDAP_PORT_MIN = 1

/** IdentityProviderLdapInput port.maximum */
export const LDAP_PORT_MAX = 65535

/** IdentityProviderLdapInput usernameField.maxLength (and attributeField) */
export const LDAP_ATTRIBUTE_MAX_LENGTH = 255

/** IdentityProviderLdapInput usernameField.pattern (format `ldapAttribute`, also attributeField) */
export const LDAP_ATTRIBUTE_PATTERN = /^[A-Za-z][A-Za-z0-9-]*$/

/** IdentityProviderGenericOidcInput scopes.pattern (format `scopeList`) */
export const SCOPES_PATTERN = /^[\x21\x23-\x5B\x5D-\x7E]+( [\x21\x23-\x5B\x5D-\x7E]+){0,49}$/

/** IdentityProviderMappingEntryInput template.maxLength (and defaultTemplate) */
export const MAPPING_TEMPLATE_MAX_LENGTH = 255

/** SingleSignOnCompletionRequest code.maxLength */
export const SSO_CODE_MAX_LENGTH = 4096

/** SingleSignOnCompletionRequest state.maxLength and SingleSignOnProviderErrorRequest state.maxLength */
export const SSO_STATE_MAX_LENGTH = 512

/** SingleSignOnProviderErrorRequest error.pattern (format `oauthErrorCode`) */
export const OAUTH_ERROR_CODE_PATTERN = /^[\x20-\x21\x23-\x5B\x5D-\x7E]{1,64}$/

/** Oauth2ClientCreateRequest redirectUris.items.maxLength */
export const REDIRECT_URI_MAX_LENGTH = 2000

// UI 010 (T020): DKIM and MTA-STS. The DKIM bulk limit and the selector, key and MX limits come
// from `getDnsCapabilities` (conventions "Where features meet").

/** DkimKeyGenerateRequest.properties.name.maxLength */
export const DKIM_NAME_MAX_LENGTH = 255

/** listDkimKeys query parameter `selector` maxLength */
export const DKIM_SELECTOR_FILTER_MAX_LENGTH = 255

/** listDkimKeys query parameter `domain` maxLength */
export const DKIM_DOMAIN_FILTER_MAX_LENGTH = 255

/** MtaStsPolicyCreateRequest.properties.mxHosts.maxItems (and MtaStsPolicyPatch) */
export const MTA_STS_MX_HOSTS_MAX_ITEMS = 128

/** MtaStsPolicyCreateRequest.properties.mxHosts.items.maxLength */
export const MTA_STS_MX_HOST_MAX_LENGTH = 255
// UI 011 (T026, T041; research R8, R12; plan "Decisions at implementation" item 26).

/** components.parameters.Limit maximum: the largest page of every list, used to list all containers */
export const LIST_LIMIT_MAX = 1000

/** components.parameters.RateLimitBucketId pattern (UI 006's bucket identifier) */
export const RATE_LIMIT_BUCKET_ID_PATTERN = /^RL[0-9A-Za-z=]+$/

/** components.parameters.RateLimitBucketId maxLength */
export const RATE_LIMIT_BUCKET_ID_MAX_LENGTH = 128

/** Fail2BanSettingsPatch banTime and maxBanTime minimum (seconds) */
export const F2B_BAN_TIME_MIN = 60

/** Fail2BanSettingsPatch banTime, maxBanTime, maxAttempts and retryWindow maximum */
export const F2B_NUMBER_MAX = 2_147_483_647

/** Fail2BanSettingsPatch maxAttempts and retryWindow minimum */
export const F2B_ATTEMPTS_MIN = 1

/** Fail2BanSettingsPatch ipv4PrefixLength and ipv6PrefixLength minimum */
export const F2B_PREFIX_MIN = 8

/** Fail2BanSettingsPatch ipv4PrefixLength maximum */
export const F2B_IPV4_PREFIX_MAX = 32

/** Fail2BanSettingsPatch ipv6PrefixLength maximum */
export const F2B_IPV6_PREFIX_MAX = 128

/** Fail2BanSettingsPatch allowlist.items.maxLength (and denylist) */
export const F2B_LIST_ENTRY_MAX_LENGTH = 253

/** LegacyApiCorsSettingsPatch.properties.allowedOrigins.items.maxLength */
export const CORS_ORIGIN_MAX_LENGTH = 2048

/** AppLinkSettingsEntry.properties.url.maxLength (and signedInUrl.oneOf[0]) */
export const APP_LINK_URL_MAX_LENGTH = 2048

/** QuotaNotificationRecipientsPatch.properties.recipients.items.maxLength */
export const QUOTA_COPY_RECIPIENT_MAX_LENGTH = 255
