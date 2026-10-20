# Data Model: Sign-in, Application Shell, Passkeys and API Keys

**Feature**: `specs/001-sign-in-app-shell` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

This app owns no persistent data. This document defines the following:

- the API data it consumes, as generated types;
- the server-state cache (query keys, freshness and invalidation);
- the small client state (Pinia, device storage and cross-tab messages);
- the route map with its address parameters;
- the client-side validation rules;
- the state machines of the sign-in flow, WebAuthn ceremonies, the idle timer and the one-time
  secret.

Decisions are justified in [research.md](./research.md). Contract shapes are not restated: types
come from `src/api/generated/schema.ts` through `@/api` (research R7).

## 1. API data consumed

These are generated root types, imported from `@/api`.

| Type | Operation(s) | Used by | Notes |
|---|---|---|---|
| `CsrfToken` | `getCsrfToken` | api client (in memory only) | R8 |
| `PublicConfig`, `Logo`, `Announcement`, `AppLink`, `LoginPageOptions`, `Language` | `getPublicConfig` | branding, sign-in screens, shell, preferences | `loginHelpHtml` and `footerHtml` are sanitised (R17) |
| `Session`, `SessionState`, `PendingSignIn`, `SecondFactorMethod` | `getSession`, `createSession`, `verifySecondFactor`, `createSessionWithPasskey` | session state machine | `idleTimeout` drives R12; `pendingSignIn.expiresAt` drives R13 |
| `PasswordSignInRequest`, `PasskeySignInRequest`, `SecondFactorVerification` | sign-in mutations | auth feature | request bodies |
| `WebAuthnChallenge`, `WebAuthnRequestOptions`, `WebAuthnAuthenticationResponse` | `createPasskeyChallenge`, `createSecondFactorWebAuthnChallenge` | WebAuthn platform module | R14 |
| `PasskeyRegistrationOptions`, `WebAuthnCreationOptions`, `PasskeyRegistrationRequest`, `WebAuthnRegistrationResponse` | `createPasskeyRegistrationOptions`, `registerPasskey` | passkeys feature, pending actions | R14 |
| `Identity`, `Scope`, `PermissionFlags`, `PendingAction`, `Preferences`, `Role` | `getIdentity` | shell, navigation, home, guards | `preferences` (with `etag`) is present for sessions |
| `PreferencesPatch` | `updatePreferences` | preferences | `If-Match: preferences.etag` |
| `Passkey`, `PasskeyPatch` | `listPasskeys`, `updatePasskey`, `deletePasskey` | passkeys feature | `etag` per entry |
| `ApiKey`, `ApiKeyCreated`, `ApiKeyCreateRequest`, `ApiKeyOwner`, `ApiKeyStatus`, `ApiKeyAccessLevel` | `listApiKeys`, `getApiKey`, `createApiKey`, `revokeApiKey` | api-keys feature | `secret` exists only in `ApiKeyCreated` |
| `ApiKeyOwnerCandidate` | `listApiKeyOwnerCandidates` | owner picker | infinite list |
| `AuditEvent`, `AuditActor`, `AuditTarget`, `AuditEventType`, `AuditOutcome`, `AuditFailureReason`, `AuthMethod` | `listAuditEvents` | audit-log feature | unknown enumeration values are tolerated (FR-074) |
| `ListMeta` | every list | lists | `total`, `limit`, `offset` |
| `Problem`, `ValidationProblem`, `FieldViolation`, `ValidationRuleCode`, `TooManyRequestsProblem`, `PendingActionProblem` | every error | `ApiProblem`, i18n | R8, R15. `KnownProblemType` is not in the bundle at the pin (plan API gap 5). |

Two operations are used without a client call: `getPublicConfigLogo` only as an `<img src>`, and
`getApiDocs` only as the target of the documentation link (FR-069). Both are among the 25 used
operations in [contracts/README.md](./contracts/README.md). Not used at all: `getPreferences` (the
identity carries the preferences), `getPasskey` (list entries carry `etag`), `getLiveness`,
`getReadiness`, `getOpenApiDocument` and `getProblemTypeDocumentation`.

## 2. App-defined models

These are not API shapes. Each is derived from API data or from app constants.

### NavigationEntry (`src/app/navigation/catalogue.ts`)

| Field | Type | Rule |
|---|---|---|
| `id` | string literal union | unique; used in `route.meta.navEntry` |
| `labelKey` | i18n key | `nav.<id>` |
| `icon` | icon component | from `src/shared/icons` |
| `path` | string | stable app address (section root), see the route map |
| `access` | `Record<Role, boolean \| { anyFlag: (keyof PermissionFlags)[] }>` | FR-043 |
| `deliveredBy` | `'001' … '013'` | feature number |
| `status` | `'available' \| 'placeholder'` | placeholders get `PlaceholderPage` (FR-044) |
| `classic` | `Partial<Record<Role, string[]>>` | classic addresses for the placeholder (research R19) |

The catalogue rows, in navigation order:

| id | path | admin | domainAdmin | mailboxUser | by | status in 001 |
|---|---|---|---|---|---|---|
| `home` | `/` | ✓ | ✓ | ✓ | 001 | available |
| `domains` | `/domains` | ✓ | ✓ | — | 002 | placeholder |
| `mailboxes` | `/mailboxes` | ✓ | ✓ | — | 003 | placeholder |
| `aliases` | `/aliases` | ✓ | ✓ | — | 004 | placeholder |
| `account` | `/account` | ✓ | ✓ | ✓ | 005 | placeholder |
| `passkeys` | `/passkeys` | ✓ | ✓ | ✓ | 001 | available |
| `quarantine` | `/quarantine` | ✓ | ✓ | ✓ | 006 | placeholder |
| `spamFilter` | `/spam-filter` | — | — | `spamScore` or `spamPolicy` | 006 | placeholder |
| `domainAdmins` | `/administrators/domain-admins` | ✓ | — | — | 007 | placeholder |
| `administrators` | `/administrators/admins` | ✓ | — | — | 007 | placeholder |
| `syncJobs` | `/sync-jobs` | ✓ | `syncjobs` | `syncjobs` | 008 | placeholder |
| `routing` | `/routing` | ✓ | `bccMaps` | — | 009 | placeholder |
| `dns` | `/dns` | ✓ | ✓ | — | 010 | placeholder |
| `operations` | `/operations` | ✓ | — | — | 011 | placeholder |
| `identityProviders` | `/identity-providers` | ✓ | — | — | 012 | placeholder |
| `system` | `/system` | ✓ | — | — | 013 | placeholder |
| `apiKeys` | `/api-keys` | ✓ | — | — | 001 | available |
| `auditLog` | `/audit-log` | ✓ | — | — | 001 | available |

The "status in 001" column is the state once feature 001 is complete. Every row starts as
`placeholder`, and the story that registers a row's routes flips it to `available`:

- `home`: US1 (T083);
- `passkeys`: US4 (T106);
- `apiKeys`: US7 (T129);
- `auditLog`: US8 (T139).

This way no navigation entry can lead to "not found" at any intermediate point (SC-007).

`visibleEntries(identity)` returns the rows whose `access[identity.role]` is `true`, or whose flag
condition holds in `identity.permissions`. The user menu holds "Passkeys", language, theme and
"Sign out" (FR-042). Passkeys appears both there and in the navigation, as the catalogue lists it.

### AppLinkView (`src/app/branding/app-links.ts`)

Derived from `AppLink` and kept in that order:

- **Sign-in screens**: `href = safeHref(url)`. Only links with `showOnLoginPage` are shown, and
  links whose `href` is `null` are dropped.
- **Header**: `href = safeHref(signedInUrl.replaceAll('%u', encodeURIComponent(username)))`.
- **Label**: `name`, as plain text.
- **Section title**: `appsLabel ?? t('apps.defaultLabel')`.

No section and no menu is shown when the list is empty (FR-001a).

### ProblemView (`src/api/problem.ts` → `src/i18n/problems.ts`)

`ApiProblem` is a runtime wrapper whose fields are typed from the generated types, not restated:
`Problem['type' | 'status' | 'requestId']`, `TooManyRequestsProblem['retryAfter']`, `FieldViolation`
and `PendingAction`. Its fields:

- `kind`: `'problem'`, `'network'`, or `'unavailable'` for a non-problem response of 500 or more,
  such as nginx's HTML 502;
- `type`, `status` and `requestId`;
- `retryAfter`: seconds, from 429 and 503;
- `fieldErrors`: a `Map<string, FieldViolation[]>`;
- `pendingActions`;
- `serverDate`: from the `Date` header.

`messageKey(problem)` resolves `problem.<name>`, then `problem.status.<status>`, then
`problem.generic`. Field messages use `validation.<code>` and fall back to `validation.invalid`.

### DisplayName of a passkey (`src/features/passkeys/display-name.ts`, FR-052)

`name ?? authenticatorDescription ?? t('passkeys.unknown', { date })`. The list is sorted newest
first (`sort=registeredAt&order=desc`).

## 3. Server-state cache

### Query keys

These come from `src/api/query/keys.ts`.

| Key | Operation | staleTime | Fetched when | Notes |
|---|---|---|---|---|
| `['public-config']` | `getPublicConfig` | 5 min | at bootstrap; when the sign-in screen opens after a sign-out | `cache: 'no-cache'` lets the ETag and `304` work. A failure falls back to the FR-003 defaults. |
| `['session']` | `getSession` | ∞ | at bootstrap; on "Stay signed in"; after `second-factor-required`, `pending-action-required` and cross-tab messages | sign-in responses write it with `setQueryData` |
| `['identity']` | `getIdentity` | 5 min | after a sign-in step that results in `active` or `restricted`; at bootstrap when signed in; on a shell navigation when older than 5 min (FR-050); after `forbidden` and `pending-action-required`; on "Check again", together with `session` | a change of `username|role|impersonation.id` unmounts the page and clears the cache (FR-037, UI 007 R4) |
| `['passkeys','list',{limit,offset,sort:'registeredAt',order:'desc'}]` | `listPasskeys` | 30 s | on the passkeys page; on the home screen with `limit: 1` for the suggestion (FR-047) | — |
| `['api-keys','list',ApiKeyListParams]` | `listApiKeys` | 30 s | on the API keys page | params come from the address (§5) |
| `['api-keys','detail',apiKeyId]` | `getApiKey` | 30 s | on the detail page | the revoke response writes it with `setQueryData` |
| `['api-keys','owner-candidates',{q,role?}]` | `listApiKeyOwnerCandidates` | 30 s | when the picker opens and on typing (debounced 300 ms) | `useInfiniteQuery`, 25 per page, by `offset` |
| `['audit-events','list',AuditListParams]` | `listAuditEvents` | 30 s | on the audit log page | params come from the address (§5) |

`ApiKeyListParams` and `AuditListParams` are aliases of the generated
`NonNullable<operations['listApiKeys']['parameters']['query']>` and
`NonNullable<operations['listAuditEvents']['parameters']['query']>`. They are not hand-written
shapes (constitution I).

### Invalidation after mutations

| Mutation | On success | On 412 |
|---|---|---|
| `createSession`, `verifySecondFactor`, `createSessionWithPasskey` | write `session`; only when the state is `active` or `restricted`, fetch `identity` and broadcast `session-changed` (research R11) | — |
| `cancelPendingSignIn` | write `session` (anonymous) | — |
| `deleteSession` | `queryClient.clear()`; broadcast `signed-out`; new CSRF token | — |
| `updatePreferences` | write `identity.preferences` from the response | refetch `identity`; apply the reloaded server value; message "changed elsewhere, choose again". FR-059 and the spec's edge case govern a single immediate choice (research R20). Any other failure restores the previous setting with a message. |
| `registerPasskey` | invalidate `['passkeys']`; refetch `identity` and `session`, because a pending `secondFactorSetup` lifts (FR-039); broadcast `session-changed` if the state changed | — |
| `updatePasskey` | replace the entry in `['passkeys','list',…]`; invalidate the other pages | keep the input; refetch the list; "changed elsewhere" (edge case) |
| `deletePasskey` | invalidate `['passkeys']` | refetch; confirm the deletion again (conventions) |
| `createApiKey` | invalidate `['api-keys','list']`; write `['api-keys','detail',id]` *without* `secret` | — |
| `revokeApiKey` | write `['api-keys','detail',id]`; invalidate `['api-keys','list']` | refetch the detail; offer to retry |

The `secret` of `ApiKeyCreated` is removed before anything is written to the cache. It is passed
only to the secret dialog's local state (FR-066).

## 4. Client state

### Pinia: `useSessionStore` (`src/app/session/store.ts`)

| Field | Type | Lifetime | Rule |
|---|---|---|---|
| `keptUsername` | `string \| null` | memory | Set when a sign-in returns to the password step (FR-024, FR-025). Cleared on success and on sign-out. Never stored (FR-091). |
| `returnTo` | `string \| null` | memory, and the sign-in address | Only values accepted by `validateReturnTo()` (FR-092) |
| `notice` | `'signedOut' \| 'sessionEnded' \| 'signInTimedOut' \| 'secondFactorRejected' \| 'secondFactorUnavailable' \| null` | one-shot | Shown and announced on the sign-in screen, then cleared |
| `lastActivityAt` | epoch ms | memory | Newest API response in any tab (R12) |
| `idleTimeout` | seconds | memory | From `Session.idleTimeout` |
| `idleWarningOpen` | boolean | memory | — |

### Pinia: `usePreferencesStore` (`src/app/preferences/store.ts`)

| Field | Type | Rule |
|---|---|---|
| `locale` | `'en-gb' \| 'cs-cz' \| 'sk-sk'` | Applied to vue-i18n, `<html lang>` (BCP 47) and the `Intl` formatters |
| `theme` | `Theme` (`light`, `dark`, `system`) | Applied to `<html class="dark">` and `color-scheme` |
| `chosenOnSignIn` | `{ locale: boolean; theme: boolean }` | `true` after an explicit choice on a sign-in screen during this visit (FR-061) |
| `availableLocales` | computed | server `languages` ∩ app locales; empty means `en-gb` with no choice and no saving (FR-060) |
| `canSave` | computed, **per field** | `canSave.theme`: the session is `active`. `canSave.locale`: the session is `active` and `availableLocales` is not empty. A restricted session applies changes on this device only. |

A profile language that the server still enables but the app does not translate (for example
`de-de`) is not applied. The app falls back to the pre-sign-in order of FR-061 and does not
overwrite the profile language unless the user chooses one.

### Device storage (`src/shared/platform/storage.ts`, each call in `try/catch`)

| Storage | Key | Value | Purpose |
|---|---|---|---|
| `localStorage` | `mailcowui-ng.locale` | locale code | language last applied (FR-061) |
| `localStorage` | `mailcowui-ng.theme` | `light`, `dark` or `system` | theme last applied; read by `public/theme-init.js` |
| `localStorage` | `mailcowui-ng.passkey-suggestion-dismissed` | `'1'` | device-wide dismissal (FR-047) |
| `sessionStorage` | `mailcowui-ng.announcement-collapsed` | SHA-256 of the announcement text, hex | collapsed for the visit; a new text shows again (FR-048) |

Nothing else is ever written. Credentials, tokens, secrets, usernames and API data never go to
storage (constitution V, FR-091). A unit test asserts that only these keys are written.

### Cross-tab messages (`BroadcastChannel('mailcowui-ng')`, `src/shared/platform/broadcast.ts`)

| Message | Sent when | Receiver does |
|---|---|---|
| `{ v: 1, type: 'activity', at: number }` | any API response except `401 unauthenticated` | updates `lastActivityAt`; closes the idle warning |
| `{ v: 1, type: 'session-changed' }` | sign-in completed; restriction lifted | `queryClient.clear()`; refetches `session` and `identity`; the guard re-routes |
| `{ v: 1, type: 'signed-out' }` | sign-out confirmed; local idle expiry | ends the session locally with `notice = 'sessionEnded'` (R11) |

Messages with an unknown `v` or `type` are ignored.

## 5. Route map

The base is `/ng/`. These are the addresses that feature 014 maps classic addresses to. "Access"
is enforced by the guard (session state) and by `ShellLayout` (catalogue).

| Name | Path | Layout | Access | Title key | Component (chunk) |
|---|---|---|---|---|---|
| `sign-in` | `/sign-in` | auth | anonymous | `auth.signIn.title` | `features/auth/pages/SignInPage.vue` (lazy, like every route) |
| `sign-in-admin` | `/sign-in/admin` | auth | anonymous | `auth.signIn.titleAdmin` | same page, `props: { role: 'admin' }` |
| `sign-in-domain-admin` | `/sign-in/domain-admin` | auth | anonymous | `auth.signIn.titleDomainAdmin` | same page, `role: 'domainAdmin'` |
| `sign-in-mailbox-user` | `/sign-in/mailbox-user` | auth | anonymous | `auth.signIn.titleMailboxUser` | same page, `role: 'mailboxUser'` |
| `sign-in-second-factor` | `/sign-in/second-factor` | auth | `pendingSecondFactor` | `auth.secondFactor.title` | `features/auth/pages/SecondFactorPage.vue` |
| `pending-actions` | `/pending-actions` | auth | `restricted` | `auth.pendingActions.title` | `features/auth/pages/PendingActionsPage.vue` |
| `home` | `/` | shell | `active`, nav `home` | `home.title` | `features/home/pages/HomePage.vue` |
| `passkeys` | `/passkeys` | shell | `active`, nav `passkeys` | `passkeys.title` | `features/passkeys/pages/PasskeysPage.vue` |
| `api-keys` | `/api-keys` | shell | `active`, nav `apiKeys` | `apiKeys.title` | `features/api-keys/pages/ApiKeysPage.vue` |
| `api-key-create` | `/api-keys/new` | shell | `active`, nav `apiKeys` | `apiKeys.create.title` | `features/api-keys/pages/ApiKeyCreatePage.vue` |
| `api-key-detail` | `/api-keys/:apiKeyId([0-9A-HJKMNP-TV-Z]{26})` | shell | `active`, nav `apiKeys` | `apiKeys.detail.title` | `features/api-keys/pages/ApiKeyDetailPage.vue` |
| `audit-log` | `/audit-log` | shell | `active`, nav `auditLog` | `auditLog.title` | `features/audit-log/pages/AuditLogPage.vue` |
| `placeholder-<id>` | catalogue `path` of each placeholder entry | shell | `active`, nav `<id>` | `nav.<id>` | `app/states/PlaceholderPage.vue` (one chunk) |
| `not-found` | `/:pathMatch(.*)*` | shell if signed in, otherwise auth | any | `states.notFound.title` | `app/states/NotFoundPage.vue` |

Rules:

- Every sign-in route accepts `?returnTo=<in-app path>`. The second-factor route keeps it.
- A role-specific screen sends `role` in every sign-in it sends (FR-005, FR-011, FR-019).
- An unauthenticated deep link goes to `sign-in?returnTo=<fullPath>`. After sign-in the app opens
  it, or `home` (FR-031).
- A later feature replaces `placeholder-<id>` with its own routes under the same `path` prefix.

### Address parameters of the lists (`useListState` schemas)

Defaults are omitted from the address. Invalid values fall back to the default and the address is
normalised with `router.replace`.

**API keys** (`/api-keys`, FR-064):

| Param | Type | Default | Maps to |
|---|---|---|---|
| `owner` | string ≤ 255 | — | `ownerUsername` (exact; picker choice or typed username) |
| `status` | `active`, `expired`, `revoked` | — | `status` |
| `access` | `readOnly`, `readWrite` | — | `accessLevel` |
| `sort` | `createdAt`, `name`, `expiresAt`, `lastUsedAt` | `createdAt` | `sort` |
| `order` | `asc`, `desc` | `desc` for `createdAt`, `asc` otherwise | `order` |
| `page` | integer ≥ 1 | 1 | `offset = (page − 1) × size` |
| `size` | 25, 50, 100 | 25 | `limit` |

**Audit log** (`/audit-log`, FR-072, FR-073):

| Param | Type | Default | Maps to |
|---|---|---|---|
| `range` | `24h`, `7d`, `30d`, `custom` | — (no limit) | `from = now − range` when the query runs, `to` unset |
| `from`, `to` | RFC 3339 | — | `from`, `to` (only with `range=custom`; `from < to`) |
| `event` | repeatable `AuditEventType` (≤ 20) | — | `eventType` (exploded) |
| `outcome` | `success`, `failure` | — | `outcome` |
| `actor` | string ≤ 255 | — | `actor` |
| `address` | IP or prefix, ≤ 49 | — | `clientAddress` |
| `page`, `size` | as above | 1, 25 | `offset`, `limit` |

The sort is always `occurredAt desc` (newest first). The `targetType` and `targetId` parameters
are reserved for the contract bump that adds target filters (research R20).

**Passkeys** (`/passkeys`): only `page` and `size`.

## 6. Client-side validation

These checks run before submitting. Server field errors are always shown too (FR-076). The numeric
limits are contract values: 255 characters, 100 networks, 49 characters per network, 20 event
types and 4096 characters for passwords. API 001 has no capabilities read, so they live in one
module, `src/shared/validation/limits.ts`. A unit test compares each limit with its `maxLength`
or `maxItems` in `contract/openapi.json`, so that a contract bump cannot leave them stale.

| Field | Rule (from the contract or spec) | Message key |
|---|---|---|
| Username | 1–255 characters after trimming | `validation.required`, `validation.tooLong` |
| Password | 1–4096 characters | `validation.required`, `validation.tooLong` |
| TOTP code | whitespace stripped, then `^[0-9]{6}$` (FR-022) | `validation.format.totpCode` |
| TOTP method | required when more than one `totp` method exists | `validation.required` |
| Yubico OTP | `^[A-Za-z0-9]{44}$` (FR-023) | `validation.format.yubicoOtp` |
| Passkey name (add) | optional; if given, 1–255 characters after trimming | `validation.tooLong` |
| Passkey name (rename) | 1–255 characters after trimming (FR-054) | `validation.required`, `validation.tooLong` |
| API key name | 1–255 characters | `validation.required`, `validation.tooLong` |
| API key owner | required; chosen from candidates (server: `notFound`, `notEligible`) | `validation.required` |
| API key expiry (specific date) | a valid local date-time, later than now; converted to UTC RFC 3339 | `validation.mustBeInFuture` |
| API key expiry presets | `now + 30`, `90` or `365` days, computed at submit | — |
| Allowed networks | ≤ 100 entries; each ≤ 49 characters and `isIpNetwork` (IPv4 `a.b.c.d[/0–32]`, IPv6 `[/0–128]`); empty entries removed | `validation.tooMany`, `validation.format.ipNetwork` |
| Audit actor | ≤ 255 characters | `validation.tooLong` |
| Audit address | ≤ 49 characters and `isIpNetwork` | `validation.format.ipNetwork` |
| Audit time range | `from` and `to` both valid; `from < to` | `auditLog.filters.rangeOrder` |

## 7. State machines

### Sign-in flow (`features/auth`)

```text
             ┌──────── cancel / limit passed / 2FA rejected ────────┐
             ▼                                                      │
 [password step] ──submit──► (busy) ──201 active──────────► [landing: returnTo or home]
   │  ▲                        │ ──201 restricted────────► [pending actions]
   │  │                        │ ──201 pendingSecondFactor► [second-factor step] ─┘
   │  └── 401 sign-in-failed / 429 / 403 second-factor-unavailable (message)
   └─passkey──► [passkey ceremony] ──201──► same landing rules as above
```

The second-factor step works as follows.

- Methods are shown in the server's order. `tier: advanced` methods sit behind "Other methods"
  unless no primary method exists (FR-020).
- One TOTP method is preselected; with several, the user chooses by name (FR-022).
- Outcomes:

  | Outcome | Next state | Notice |
  |---|---|---|
  | `200` | the state of the returned session | — |
  | `401 second-factor-failed` | password step | `secondFactorRejected` (FR-024) |
  | `401 sign-in-expired` | password step | `signInTimedOut` |
  | `503 temporary-verification-failure` | stays in the step; retry or another method | — (FR-027) |
  | WebAuthn prompt cancelled (`NotAllowedError`) | stays in the step; retry or another method; no request sent | — (FR-021) |
  | `403 second-factor-unavailable` (from the password step) | sign-in screen | `secondFactorUnavailable` (FR-028) |
  | countdown reaches 0 | `DELETE /session/pending-sign-in`, then password step | `signInTimedOut` |
  | "Cancel" | `DELETE /session/pending-sign-in`, then sign-in screen | — (FR-026) |

### WebAuthn ceremony (`shared/platform/webauthn/ceremony.ts`)

```text
idle ─start→ requesting-options ─ok→ awaiting-authenticator ─credential→ verifying ─ok→ done
  ▲               │ problem                 │ NotAllowed/Abort (silent)     │ problem
  └───────────────┴─────────────────────────┴───────────────────────────────┘ (message per R14)
```

Starting any ceremony aborts the running one first. The conditional sign-in ceremony restarts
30 s before its challenge expires while the page is visible.

### Idle timer (`app/session/idle-timer.ts`)

```text
active ──(deadline − 120 s)──► warning ──(deadline)──► expired → sign-in (notice: sessionEnded, returnTo)
  ▲                               │
  └── activity in any tab / "Stay signed in" (GET /session → active)
```

The timer runs only while the session is `active` or `restricted`.

### One-time secret dialog (`features/api-keys/components/ApiKeySecretDialog.vue`)

```text
shown(secret) ──copy ok──► copied ──close──► closed (secret cleared; replace route → key detail)
     │ copy refused → secret selected for manual copy, with a message
     └──close without copy, Escape, or leaving the page (Back, link)──► confirm "Have you saved
                                                       the secret?" ──yes──► closed
                                                                    └─no──► shown
```

The secret lives only in the dialog's local `ref`. It is not in route state, the query cache,
storage or history, and closing clears it. No history entry is pushed while the dialog is open,
so Back and Forward cannot bring it back (FR-066, US7 AS-11). While the dialog is open,
`onBeforeRouteLeave` on `ApiKeyCreatePage` asks the same confirmation before any navigation
(FR-080).
