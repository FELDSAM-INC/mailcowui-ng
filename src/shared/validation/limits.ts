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
