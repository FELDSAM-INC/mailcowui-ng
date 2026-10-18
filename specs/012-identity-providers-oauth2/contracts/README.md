# Contracts of UI feature 012

This app exposes no API of its own. Its only interface is the mailcow-rest-v2 contract it consumes
(constitution I). That contract is not duplicated here. This file records the pin that UI 012
needs, the operations it uses and how the app responds to each problem type. Vendoring and client
generation are unchanged from [UI 001](../../001-sign-in-app-shell/contracts/README.md).

## Pinned contract

| Field | Value |
|---|---|
| API repository | `FELDSAM-INC/mailcow-rest-v2` |
| API feature | 012: identity providers, single sign-on, OAuth2 clients; plus its additive changes to API 001 |
| Contract version (`info.version`) | `0.1.0` (does not identify the contract, 001 R6) |
| Minimum pinned commit | `a563357c9d1037bec3cdb548bfe33fe859abe138` (2026-10-18, "Record 011 analysis") |
| Bundle | `@redocly/cli@2.64.1 bundle api/openapi.yaml` |
| Bundle sha256 at the minimum commit | `75ee9d1fcdbec547c8115d845a62aa6375530c502d40574f671cfd14b721fd82` |
| Operations at the minimum commit | 376, of which 19 belong to API 012 |

**Rule for T001**: when work on UI 012 starts, `contract/VERSION.json` holds the pin of the last
earlier UI feature.

- If that commit is `a563357` or later and its bundle contains the 19 operations below with the
  members this feature uses, **no bump is needed**.
- Otherwise run `scripts/contract/bump.sh a563357c9d1037bec3cdb548bfe33fe859abe138`, or a later
  commit, followed by `npm run typecheck`, `npm run test:unit` and `npm run test:e2e`.
- Never pin a commit older than the current one.
- Record the commit and sha256 actually used in this table.

At the minimum commit, `KnownProblemType` is still missing from the bundle (UI 001 plan, API
gap 5). The fix exists only uncommitted in the API working tree. The translation check derives the
problem types from the bundle text, as in UI 001.

## Operations used by this feature

### API 012 (all 19 are used)

| operationId | Method and path | Used by | Requirements |
|---|---|---|---|
| `getIdentityProviderCapabilities` | GET `/capabilities/identity-provider` | setup defaults, limits, types, return addresses; overview | FR-010, FR-011, FR-018, FR-027 |
| `getIdentityProvider` | GET `/identity-provider` | overview, sections, usage, sync status, type-change setup | FR-004 to FR-008, FR-020 |
| `saveIdentityProvider` | PUT `/identity-provider` | setup save, type change | FR-012, FR-013, FR-014 |
| `updateIdentityProvider` | PATCH `/identity-provider` (merge patch) | section saves | FR-015 to FR-017, FR-024, FR-025 |
| `deleteIdentityProvider` | DELETE `/identity-provider` | removal | FR-039, FR-014 |
| `testIdentityProviderConnection` | POST `/identity-provider/connection-tests` | test panel (setup, connection edit, overview) | FR-033 to FR-038 |
| `startSingleSignOn` | POST `/session/single-sign-on` | sign-in action, "Try again" | FR-040, FR-043, FR-048 |
| `cancelSingleSignOn` | DELETE `/session/single-sign-on` | return without a reportable error, or with a code or a state alone | FR-048 |
| `completeSingleSignOn` | POST `/session/single-sign-on/completion` | return page | FR-046 to FR-048 |
| `reportSingleSignOnProviderError` | POST `/session/single-sign-on/provider-error` | return page (provider error) | FR-048 |
| `getOauth2ClientsCapabilities` | GET `/capabilities/oauth2-clients` | info panel, redirect URI limit, bulk limit | FR-057, FR-058, FR-065 |
| `listOauth2Clients` | GET `/oauth2-clients` | OAuth2 list | FR-054 to FR-056 |
| `createOauth2Client` | POST `/oauth2-clients` | create page | FR-058, FR-059 |
| `bulkOauth2ClientAction` | POST `/oauth2-clients/bulk-actions` | bulk revoke and delete | FR-065 |
| `getOauth2Client` | GET `/oauth2-clients/{oauth2ClientId}` | client page | FR-060 |
| `updateOauth2Client` | PATCH `/oauth2-clients/{oauth2ClientId}` (merge patch) | redirect URIs | FR-060, FR-061, FR-066 |
| `deleteOauth2Client` | DELETE `/oauth2-clients/{oauth2ClientId}` | delete | FR-064, FR-066 |
| `regenerateOauth2ClientSecret` | POST `/oauth2-clients/{oauth2ClientId}/secret-regeneration` | new secret | FR-062, FR-066 |
| `revokeOauth2ClientTokens` | POST `/oauth2-clients/{oauth2ClientId}/token-revocation` | revoke tokens | FR-063, FR-066 |

### Earlier API features, used in a new way

| operationId | Feature | New use | Requirements |
|---|---|---|---|
| `getPublicConfig` | 001 | `externalIdentityProvider.singleSignOnAvailable` and `loginPage.forceSingleSignOn` drive the sign-in composition; refetched after a save, a removal and `single-sign-on-not-available` | FR-040 to FR-043, FR-012, FR-039 |
| `createSession` | 001 | `503 identity-provider-unavailable`; provider `authMethod` values | FR-050, FR-051 |
| `getIdentity` | 001 | `authentication.method` and `authentication.identityProvider` for the sign-out note | FR-053 |
| `deleteSession` | 001 | sign-out notice `signedOutSso` | FR-053 |
| `getCsrfToken`, `getSession` | 001 | the bootstrap on the return page, after the capture | FR-045 |
| `listAuditEvents` | 001, 002 | `targetType` `identityProvider` and `oauth2Client`, `targetId`, `actor` and `eventType` for History and the sign-in link | FR-067 |
| `listMailboxTemplates` | 003 | template choices for the mapping and the default template | FR-029, FR-031 |

`listMailboxes` (003) is not called. The app only links to UI 003's mailbox list filtered by
`authSource`.

### Members this feature relies on (checked by T001 when the pin moves)

- `IdentityProviderCommon`: `complete`, `missingSettings`, `mailboxCounts`
  (`keycloak`, `genericOidc`, `ldap`), `defaultTemplateExists`, `modifiedAt` and `etag`.
- `IdentityProviderReturnUrls.appReturnUrls`.
- `IdentityProviderKeycloak` and `IdentityProviderLdap` `synchronisation`: `enabled`, `state`,
  `lastCompletedAt`, `lastFailedAt` and `nextRunExpectedAt`.
- `IdentityProviderCapabilities`: `configured`, `configuredType`, `appReturnUrls`, `types`,
  `defaults`, `limits`, `providerTimeoutSeconds` and `singleSignOn`.
- `IdentityProviderConnectionTestResult`: `type`, `testedAddress`, `testedAt`, `outcome`,
  `failureCategory` and `providerStatus`.
- `IdentityProviderInUseProblem`: `blockingMailboxes` and `mailboxCounts`.
- `SingleSignOnStart.authorizationUrl`.
- `SingleSignOnCompletionRequest` (code 1–4,096 and state 1–512 characters).
- `SingleSignOnProviderErrorRequest.error` and its pattern.
- `Oauth2Client`: `id`, `clientId`, `redirectUris`, `scope`, `activeAccessTokens`,
  `activeRefreshTokens` and `etag`.
- `Oauth2ClientWithSecret.clientSecret`.
- `Oauth2ClientCapabilities`: `endpoints`, `scope`, `grantTypes`, `accessTokenLifetimeSeconds`,
  `refreshTokenLifetimeSeconds`, `redirectUrisMaxLength` and `bulkLimit`.
- `Oauth2ClientBulkActionRequest`: `action` and `targets[{ id, version }]`.
- `PublicConfig.externalIdentityProvider.singleSignOnAvailable` and
  `LoginPageOptions.forceSingleSignOn`.
- `IdentityAuthentication.identityProvider`.
- The `AuthMethod`, `AuditEventType`, `AuditTarget` and `AuditFailureReason` values of API 012.

## Problem types and the app's response

Messages come from `problem.<name>` and `validation.<code>`, never from `title` or `detail`
(FR-068).

| `type` (`/api/v2/problems/…`) | Status | Operation(s) | App behaviour |
|---|---|---|---|
| `identity-provider-not-configured` | 404 | get, patch, delete | `get`: the empty state, not an error (FR-004). `patch`/`delete`: the configuration was removed elsewhere; cache set to `null`, empty state with an explanation |
| `identity-provider-in-use` | 409 | put, delete | `InUseMessage` with `blockingMailboxes`, per-source counts and links; nothing changed; configuration refetched (FR-014) |
| `single-sign-on-not-available` | 409 | start, completion | "Single sign-on is not offered"; refetch the public configuration; action hidden (FR-043, FR-048) |
| `sign-in-state-invalid` | 401 | completion, provider error | Completion: "sign-in expired or already completed", Try again (a new start). Provider error: ignored, the "cancelled" message stays. Never treated as a session end. |
| `sign-in-failed` | 401 | completion; `createSession` | Return page: generic "did not succeed", no reason. Password form: UI 001 behaviour. |
| `identity-provider-unavailable` | 503 | completion, `createSession` | "The organisation's sign-in service is not reachable"; on the password form the username is kept and the password cleared, with no countdown despite `Retry-After` (FR-051) |
| `identity-provider-session-ended` | 401 | any authenticated request | Session ended with notice `ssoSessionEnded`, `returnTo` = current page, single sign-on offered; no redirect to the provider (FR-052) |
| `validation-failed` | 422 | put, patch, tests, OAuth2 create and patch, bulk | Field errors at their fields or entries, with a summary. `secretRequired` (`reason`), `notFound` (`resource: mailboxTemplate`), `duplicate` (`duplicateOf`), `conflictsWith` (`field`), `immutable`, `tooMany` (the bulk limit) and the API 012 `invalidFormat` formats are translated (R26) |
| `about:blank` 404 | 404 | OAuth2 client operations | Not-found state with a link to the list (edge case) |
| `about:blank` 412 | 412 | put (change mode), patch, delete; OAuth2 patch, delete, regenerate, revoke | Section saves: input kept, changed values marked (FR-017). Destructive actions: refetch and confirm again (FR-066). |
| `forbidden` | 403 | admin operations | "No permission" in context, as UI 001; cannot happen through the UI, because the screens are admin-only |
| `csrf-token-mismatch` | 403 | every write | UI 001's silent retry |
| unknown types, `500`, network failures | — | any | UI 001's generic message with the request ID; on the return page with "Try again" |

`BulkResult` items with `refused`, `outdated` or `failed` carry a `problem`. The summary shows its
translated message per client.
