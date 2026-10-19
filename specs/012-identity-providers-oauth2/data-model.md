# Data Model: Identity Providers and OAuth2

**Feature**: `specs/012-identity-providers-oauth2` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

The app owns no persistent data. This document defines:

- the API data UI 012 consumes, as generated types;
- the app-defined models derived from it;
- the query keys and invalidation;
- the client state, including one new storage key;
- the routes and address parameters;
- the client-side validation;
- the state machines of single sign-on, the setup flow, section editing, the connection test and the
  OAuth2 actions;
- the legacy translation keys used verbatim.

It extends [UI 001's data model](../001-sign-in-app-shell/data-model.md) and does not repeat it.
Contract shapes are never restated: types come from `src/api/generated/schema.ts` through `@/api`
(001 R7). Decisions are justified in [research.md](./research.md).

## 1. API data consumed

These are generated root types, re-exported from `src/api/index.ts`.

| Type | Operation(s) | Used by | Notes |
|---|---|---|---|
| `IdentityProviderCapabilities`, `IdentityProviderType` | `getIdentityProviderCapabilities` | setup, overview, validation | defaults, limits, types, `appReturnUrls`, `providerTimeoutSeconds` |
| `IdentityProvider` (= `IdentityProviderKeycloak` \| `IdentityProviderGenericOidc` \| `IdentityProviderLdap`), `IdentityProviderCommon`, `IdentityProviderReturnUrls`, `IdentityProviderMappingEntry`, `IdentityProviderMailboxCounts`, `IdentityProviderSynchronisation` | `getIdentityProvider`, `saveIdentityProvider`, `updateIdentityProvider` | overview, sections, usage, sync status | `etag` per configuration; `404 identity-provider-not-configured` is read as `null` (R10) |
| `IdentityProviderInput` (`…KeycloakInput`, `…GenericOidcInput`, `…LdapInput`, `IdentityProviderCommonInput`, `IdentityProviderReturnUrlsInput`, `IdentityProviderMappingEntryInput`) | `saveIdentityProvider`, `testIdentityProviderConnection` | setup save, tests | built by `toInput()` (R11) |
| `IdentityProviderPatch` | `updateIdentityProvider` (`application/merge-patch+json`) | section saves | built by `toPatch()` (R13) |
| `IdentityProviderConnectionTestResult` | `testIdentityProviderConnection` | test panel | memory only |
| `IdentityProviderInUseProblem` | `409` of save and delete | `InUseMessage` | `blockingMailboxes`, `mailboxCounts` via the typed extension guard (R17) |
| `SingleSignOnStart` | `startSingleSignOn` | sign-in action | `authorizationUrl` checked with `safeHref()` |
| `SingleSignOnCompletionRequest`, `SingleSignOnProviderErrorRequest` | `completeSingleSignOn`, `reportSingleSignOnProviderError` | return page | request bodies, built from captured values |
| `Session`, `AuthMethod` | `completeSingleSignOn` (`201 SessionCreated`), `createSession` | session state machine | `authMethod: singleSignOn`, `directoryPassword…`, `providerPassword…` |
| `Identity`, `IdentityAuthentication` | `getIdentity` | sign-out note | `authentication.method`, `authentication.identityProvider` |
| `PublicConfig` (`externalIdentityProvider.singleSignOnAvailable`, `loginPage.forceSingleSignOn`) | `getPublicConfig` | sign-in composition | R7 |
| `Oauth2ClientCapabilities` | `getOauth2ClientsCapabilities` | info panel, bulk limit, redirect URI limit | — |
| `Oauth2Client`, `ListMeta` | `listOauth2Clients`, `getOauth2Client`, `updateOauth2Client`, `revokeOauth2ClientTokens` | list, detail | `etag` per client; never a secret |
| `Oauth2ClientWithSecret` | `createOauth2Client`, `regenerateOauth2ClientSecret` | credentials dialog only | called on the client directly; `clientSecret` goes to the dialog's state and is never cached |
| `Oauth2ClientCreateRequest`, `Oauth2ClientPatch` | create, update | forms | — |
| `Oauth2ClientBulkActionRequest`, `Oauth2ClientBulkTarget`, `BulkResult`, `BulkItemResult`, `BulkItemOutcome` | `bulkOauth2ClientAction` | bulk | `targets[].version` = the list entry's `etag` without its quotes (`toBulkTargets()`) |
| `MailboxTemplate` (API 003) | `listMailboxTemplates` through UI 003's "all templates" query | template choice | `limit=1000&sort=name` (R10) |
| `AuditEvent`, `AuditEventType`, `AuditTarget`, `AuditFailureReason`, `AuthMethod` | `listAuditEvents` (UI 001/002) | audit labels and details | API 012 values (R23) |

`cancelSingleSignOn` has no body or response data. `deleteIdentityProvider` and
`deleteOauth2Client` answer `204`.

## 2. App-defined models

These are not API shapes. Each one is derived from API data or app constants.

### Sections per type (`provider/sections.ts`, FR-006)

| Section id | Keycloak | Generic OIDC | LDAP |
|---|---|---|---|
| `connection` | `serverUrl`, `realm`, `version`, `clientId`, `clientSecret`, `ignoreTlsErrors` | `authorizationEndpoint`, `tokenEndpoint`, `userInfoEndpoint`, `clientId`, `clientSecret`, `scopes`, `ignoreTlsErrors` | `hosts`, `port`, `connectionSecurity` (= `useSsl` + `useStartTls`), `bindDn`, `bindPassword`, `ignoreTlsErrors` |
| `directorySearch` | — | — | `baseDn`, `usernameField`, `filter`, `attributeField` |
| `returnAddresses` | `appReturnUrls` (read-only), `legacyReturnUrl`, `additionalReturnUrls` | same | — |
| `signIn` | `mailpasswordFlow`, `createMailboxOnSignIn`, `attributeMapping`, `defaultTemplate` | `createMailboxOnSignIn`, `attributeMapping`, `defaultTemplate` | `createMailboxOnSignIn`, `attributeMapping`, `defaultTemplate` |
| `synchronisation` | `importUsers`, `periodicSync`, `syncInterval`, `synchronisation` (read-only status) | — | same as Keycloak |

`fieldSection(type, member)` maps an API error path such as `attributeMapping.2.template` to its
section and field, for the error summary (R13).

### Setup steps (`provider/setup-steps.ts`, FR-009)

| Step (`?step=`) | Keycloak | Generic OIDC | LDAP | Sections shown |
|---|---|---|---|---|
| `type` | 1 | 1 | 1 | type choice (FR-010) |
| `connection` | 2 | 2 | 2 | `connection` (+ `directorySearch` for LDAP) + test panel |
| `return-addresses` | 3 | 3 | — | `returnAddresses` |
| `sign-in` | 4 | 4 | 3 | `signIn` (+ `synchronisation` for Keycloak and LDAP) |
| `review` | 5 | 5 | 4 | summary, latest test result, return addresses, Save |

### Form state (`provider/form-model.ts`, R11)

`ProviderForm = KeycloakForm | OidcForm | LdapForm`, discriminated by `type`. It is derived with
mapped types from the generated input types: every member is required, nullable strings become
`string` (`''` = empty), and the secret is a `string` (`''` = not typed). For `LdapForm`, `useSsl`
and `useStartTls` are replaced by `connectionSecurity`:

| `connectionSecurity` | `useSsl` | `useStartTls` | Hint (FR-019) |
|---|---|---|---|
| `none` | `false` | `false` | — |
| `ssl` | `true` | `false` | with port 389: "Port 636 will be used" (`admin.iam_use_ssl_info`) |
| `startTls` | `false` | `true` | "Use the directory's standard port" (`admin.iam_use_tls_info`) |

From a stored configuration, `useSsl: true` maps to `ssl` whatever `useStartTls` says, matching the
API's normalisation.

### Secret rule (`provider/secret-rule.ts`, FR-024, FR-025, FR-034)

| Type | Secret member | Address member that receives it |
|---|---|---|
| `keycloak` | `clientSecret` | `serverUrl` |
| `genericOidc` | `clientSecret` | `tokenEndpoint` |
| `ldap` | `bindPassword` | `hosts` (ordered list, trimmed) |

`secretRequirement(context)` returns `null` (optional) or the reason `noStoredSecret` (setup, or no
stored configuration of this type), `typeChanged` or `addressChanged`, matching the API's
`secretRequired` reasons.

### Test dependencies (`provider/connection-test.ts`, FR-037)

A result becomes stale when one of these values differs from the tested candidate:

| Type | Members |
|---|---|
| `keycloak` | `serverUrl`, `realm`, `clientId`, `clientSecret`, `version`, `ignoreTlsErrors` |
| `genericOidc` | `tokenEndpoint`, `clientId`, `clientSecret`, `ignoreTlsErrors` |
| `ldap` | `hosts`, `port`, `connectionSecurity`, `bindDn`, `bindPassword`, `ignoreTlsErrors` |

The test panel holds `ConnectionTestView`:
- `state`: `idle`, `running`, `result`, `noResult` or `error`;
- `result: IdentityProviderConnectionTestResult | null`;
- `testedValues`: the members above, in memory only;
- `stale: boolean`.

### Usage availability (`provider/usage.ts`, FR-005, FR-013, FR-039)

From `mailboxCounts` (`keycloak`, `genericOidc`, `ldap`):

- `total` = the sum of the three counts.
- `canRemove` = `total === 0`.
- `blocked(T)` = the counts of the sources other than `T` add up to more than 0.
- `changeableTypes` = the types other than the configured type that are not blocked.
- `canChangeType` = `changeableTypes` is not empty.
- `links` = one per source with a count above 0: `{ source, count, to: { name: 'mailboxes', query: { source } } }`.
  UI 003's mailbox list parameter `source` maps to the API's `authSource` filter.

### Synchronisation view (`provider/sync-status.ts`, FR-020)

| `state` | Label key | Icon | Extra explanation |
|---|---|---|---|
| `disabled` | `identityProvider.sync.state.disabled` | info | — |
| `running` | `…state.running` | progress | — |
| `waiting` | `…state.waiting` | success | — |
| `overdue` | `…state.overdue` | warning | unlogged failures show only as overdue |
| `unknown` | `…state.unknown` | warning | the log keeps a limited number of entries |

Interval wording `formatInterval(minutes, locale)`:
- days when `minutes % 1440 === 0`;
- otherwise hours when `minutes % 60 === 0`;
- otherwise minutes.

Each unit is formatted with `Intl.NumberFormat` (`style: 'unit'`, `unitDisplay: 'long'`).

Job-log task per type: `keycloak` → `Keycloak Sync`, `ldap` → `LDAP Sync` (the API 012 data model's
`CRON_LOG` task values). The link is `{ name: 'operations-log', params: { logType: 'cron' }, query:
{ task } }` (UI 011), shown only when that route exists and `canAccess('logs')` holds.

### Return-path check (`provider/return-addresses.ts`, FR-027)

`mismatchedReturnUrls(urls)` returns the addresses whose `new URL(u).pathname` is not
`import.meta.env.BASE_URL + 'sso/return'`. The return addresses section warns when the list is not
empty.

### Single sign-on round trip (`features/auth/sso/`, FR-043 to FR-049)

| Model | Where | Lifetime | Content |
|---|---|---|---|
| `CapturedReturn` | module variable in `capture.ts` | from the entry module until `takeCapturedSingleSignOnReturn()` | `{ code?: string; state?: string; error?: string }`, the first values of the query; nothing else is read |
| Kept address | `sessionStorage` `mailcowui-ng.sso-return-to` | written right before `location.assign`, removed on return and when the sign-in page mounts | a path accepted by `validateReturnTo()` (001 R11), never anything else |
| `ReturnPageState` | `useSingleSignOnReturn()` | the return page | `completing`, `reporting`, `cancelling`, `failed(outcome)` or `redirecting` |

Return classification (R6):

| Input | Classification | Request |
|---|---|---|
| `code` (1–4,096) and `state` (1–512), no `error` | `complete` | `completeSingleSignOn` |
| `error` matching `^[\x20-\x21\x23-\x5B\x5D-\x7E]{1,64}$` and `state` (1–512) | `providerError` | `reportSingleSignOnProviderError` |
| `error` otherwise | `providerErrorUnreportable` | `cancelSingleSignOn` |
| exactly one of `code` and `state`, or an over-long value | `malformed` | `cancelSingleSignOn` |
| nothing | `empty` | none |

### OAuth2 list item view (`oauth2/components/`, FR-055)

`TokenCounts` shows `activeAccessTokens` and `activeRefreshTokens`, or "No active tokens" when both
are 0. The first redirect URI is shown, plus "+N more" (`redirectUris.length − 1`), or "No redirect
URI stored" when the list is empty.

### Redirect URI rule (`oauth2/redirect-uris.ts`, FR-058, FR-061)

`checkRedirectUri(value)` returns the first rule an entry breaks:

1. `required`: the entry is empty after trimming.
2. `invalidFormat` (`redirectUri`): no scheme `^[A-Za-z][A-Za-z0-9+.-]*:`, `URL` cannot parse it, it
   contains `#`, or it contains whitespace.
3. `tooLong`: more than 2,000 characters.

`checkRedirectUris(list, limit)` adds `duplicate` (with `duplicateOf`), `required` for an empty list,
and `tooLong` on the list when `list.join(' ').length > capabilities.redirectUrisMaxLength`. It also
returns `remaining` for the counter.

## 3. Server-state cache

### Query keys (added to `src/api/query/keys.ts`)

| Key | Operation | staleTime | Fetched when | Notes |
|---|---|---|---|---|
| `['identity-provider','capabilities']` | `getIdentityProviderCapabilities` | 5 min | overview, setup | — |
| `['identity-provider','configuration']` | `getIdentityProvider` | 30 s | overview; setup in type-change mode | `null` for `identity-provider-not-configured` |
| `['mailbox-templates','all']` (UI 003) | `listMailboxTemplates` (`limit=1000&sort=name`) | 30 s | when a mapping field or the default template choice mounts | UI 003's query, reached through `@/features/mailboxes` |
| `['oauth2-clients','capabilities']` | `getOauth2ClientsCapabilities` | 5 min | OAuth2 list, create, detail | — |
| `['oauth2-clients','list',Oauth2ClientListParams]` | `listOauth2Clients` | 30 s | OAuth2 list | params from the address (§5); `Oauth2ClientListParams` aliases the generated query type |
| `['oauth2-clients','detail',oauth2ClientId]` | `getOauth2Client` | 30 s | client page | — |

### Invalidation after mutations

Requests marked "direct" carry a secret, a provider code or a provider state in the body or the
response. Following `docs/conventions.md` ("Secrets in requests or responses"), they call the
generated client directly instead of `useMutation`, and only their secret-free result is written to
the cache.

| Mutation | On success | On 412 | Other |
|---|---|---|---|
| `saveIdentityProvider` (PUT), direct | write `configuration`; invalidate `capabilities` and `['public-config']` | type-change mode: refetch `configuration`, keep the entries, ask to save again | `409`: refetch `configuration` |
| `updateIdentityProvider` (PATCH), direct | write `configuration`; invalidate `['public-config']` when `complete` changed | refetch, field diff (R13) | `404`: set `configuration` to `null` |
| `deleteIdentityProvider` | set `configuration` to `null`; invalidate `capabilities` and `['public-config']` | refetch; confirm again | `409`: refetch `configuration` |
| `testIdentityProviderConnection`, direct | none (result in component state) | — | — |
| `startSingleSignOn` | none (navigates away) | — | `409`: invalidate `['public-config']` |
| `completeSingleSignOn`, direct | write `['session']`, fetch `['identity']`, broadcast `session-changed` (as 001 sign-ins) | — | `409`: invalidate `['public-config']` |
| `reportSingleSignOnProviderError` (direct), `cancelSingleSignOn` | none | — | — |
| `createOauth2Client`, direct | write `detail` without `clientSecret`; invalidate `['oauth2-clients','list']` | — | the secret goes to the dialog's state only |
| `updateOauth2Client` | write `detail`; invalidate the list | keep the input, refetch, field diff | `404`: not-found state |
| `regenerateOauth2ClientSecret`, direct | write `detail` without `clientSecret` | refetch; confirm again | the secret goes to the dialog's state only |
| `revokeOauth2ClientTokens` | write `detail`; invalidate the list | refetch; confirm again | — |
| `deleteOauth2Client` | remove `detail`; invalidate the list | refetch; confirm again | — |
| `bulkOauth2ClientAction` | invalidate the list; remove `detail` of `done` deletions | per-item `outdated` | network failure: "outcome unknown", no retry |

## 4. Client state

### Pinia `useSessionStore` (`src/app/session/store.ts`), changed

`notice` gains two values (R9):

| Value | Set when | Shown on the sign-in screen |
|---|---|---|
| `ssoSessionEnded` | any request answers `401 identity-provider-session-ended` | "Your single sign-on session ended …" with the single sign-on action when available |
| `signedOutSso` | a sign-out succeeds while `identity.authentication.method === 'singleSignOn'` | the sign-out confirmation plus the provider note (FR-053) |

### Device storage (`src/shared/platform/storage.ts`), changed

The allowlist of UI 001 data-model §4 gains one entry:

| Storage | Key | Value | Purpose |
|---|---|---|---|
| `sessionStorage` | `mailcowui-ng.sso-return-to` | an in-app path accepted by `validateReturnTo()` | the page to open after a single sign-on round trip in this tab (FR-043, FR-047) |

Nothing else is written. The provider's code and state, secrets and client secrets never go to
storage (FR-081, SC-003).

## 5. Route map

The base is `/ng/`. These routes are added to UI 001's map.

| Name | Path | Layout | Access | Title key | Component (chunk) |
|---|---|---|---|---|---|
| `sso-return` | `/sso/return` | auth | every session state (`meta.anySession`) | `auth.sso.return.title` | `features/auth/pages/SingleSignOnReturnPage.vue` |
| `identity-providers` | `/identity-providers` | shell | `active`, nav `identityProviders` | — | redirect to `identity-provider` |
| `identity-provider` | `/identity-providers/provider` | shell | `active`, nav `identityProviders` | `identityProvider.title` | `features/identity-providers/provider/pages/IdentityProviderPage.vue` |
| `identity-provider-setup` | `/identity-providers/provider/setup` | shell | `active`, nav `identityProviders` | `identityProvider.setup.title` | `features/identity-providers/provider/pages/IdentityProviderSetupPage.vue` |
| `oauth2-clients` | `/identity-providers/oauth2-apps` | shell | `active`, nav `identityProviders` | `oauth2.title` | `features/identity-providers/oauth2/pages/Oauth2ClientsPage.vue` |
| `oauth2-client-create` | `/identity-providers/oauth2-apps/new` | shell | `active`, nav `identityProviders` | `oauth2.create.title` | `features/identity-providers/oauth2/pages/Oauth2ClientCreatePage.vue` |
| `oauth2-client-detail` | `/identity-providers/oauth2-apps/:oauth2ClientId(\d{1,10})` | shell | `active`, nav `identityProviders` | `oauth2.detail.title` | `features/identity-providers/oauth2/pages/Oauth2ClientDetailPage.vue` |

- The catalogue entry `identityProviders` changes from `placeholder` to `available`, and gains UI
  011's `group: 'system'`, in the story that registers `identity-provider` (US1). The OAuth2 routes
  arrive in US5, and the sub-navigation shows their link only once they are registered (R3).
- UI 014's mapping M24 (`/edit/oauth2client/{id}`) targets `oauth2-client-detail`.
- Outgoing links to other features' routes, each resolved by route name and rendered only when that
  route exists:
  - `mailboxes` with `?source=<type>` (UI 003);
  - `mailbox-templates` (UI 003);
  - `mailbox-detail` with the address (UI 003);
  - `operations-log` with `logType: 'cron'` and `?task=<name>` (UI 011);
  - `audit-log` with `targetType`, `targetId`, `actor` and `event` (UI 001/002).

### Address parameters

**Setup** (`/identity-providers/provider/setup`):

| Param | Values | Default | Rule |
|---|---|---|---|
| `mode` | `change` | — (first setup) | `change` requires a stored configuration; otherwise it is dropped with `replace` |
| `step` | `type`, `connection`, `return-addresses` (Keycloak and OIDC only), `sign-in`, `review` | `type` | narrow screens only. A step beyond the furthest validated one is normalised with `replace`. Next and Back use `push`. |

**OAuth2 list** (`/identity-providers/oauth2-apps`, FR-054):

| Param | Type | Default | Maps to |
|---|---|---|---|
| `q` | string ≤ 255 | — | `q` |
| `tokens` | `active`, `none` | — | `hasActiveTokens` `true` / `false` |
| `sort` | `id`, `clientId`, `redirectUri` | `id` | `sort` |
| `order` | `asc`, `desc` | `asc` | `order` |
| `page` | integer ≥ 1 | 1 | `offset = (page − 1) × size` |
| `size` | 25, 50, 100 | 25 | `limit` |

Changing `q`, `tokens`, `sort`, `order` or `size` resets `page` and the bulk selection.

## 6. Client-side validation

These checks run before a step advances, a section saves or a test runs (FR-018). The API's field
errors are always shown too. "Cap." means a limit from `IdentityProviderCapabilities.limits`.
"Contract" means a constant in `src/shared/validation/limits.ts` that UI 001's limits test checks
against `contract/openapi.json`.

| Field | Rule | Source | Message key |
|---|---|---|---|
| Keycloak `serverUrl` | required; absolute `http(s)` URL; ≤ `urlMaxLength` | Cap. | `validation.required`, `validation.format.httpUrl`, `validation.tooLong` |
| `realm` | 1–255 characters; no `/` | Contract | `validation.tooLong`, `validation.format.keycloakRealm` |
| `clientId` | 1–255 characters | Contract | `validation.required`, `validation.tooLong` |
| `version` | required; `^[0-9]+(\.[0-9]+){0,3}$`; ≤ 64 | Contract | `validation.format.keycloakVersion` |
| OIDC endpoints (3) | required; absolute `http(s)` URL; ≤ `urlMaxLength` | Cap. | as `serverUrl` |
| `scopes` | 1 to `scopesMaxEntries` names separated by single spaces; no `"`, `\` or other whitespace | Cap. | `validation.format.scopeList` |
| LDAP `hosts` | 1 to `ldapHostsMaxEntries` entries; each `isLdapHost()` and ≤ 253 | Cap., Contract | `validation.tooMany`, `identityProvider.form.errors.hosts.invalidFormat` (not UI 008's IPv4-only `validation.format.hostName`) |
| `port` | integer 1–65,535 | Contract | `validation.outOfRange` |
| `baseDn`, `bindDn` | 1 to `distinguishedNameMaxLength` characters | Cap. | `validation.required`, `validation.tooLong` |
| `usernameField` | `^[A-Za-z][A-Za-z0-9-]*$`; ≤ 255 | Contract | `validation.format.ldapAttribute` |
| `attributeField` | empty or as `usernameField`; required while `importUsers` or `periodicSync` | Contract | `validation.format.ldapAttribute`, `validation.conflictsWith` |
| `filter` | empty, or ≤ `filterMaxLength`, starting with `(`, ending with `)`, balanced parentheses | Cap. | `validation.format.ldapFilter` |
| `legacyReturnUrl` | required; absolute `http(s)` URL; ≤ `urlMaxLength` | Cap. | `validation.required`, `validation.format.httpUrl` |
| `additionalReturnUrls` | ≤ `additionalReturnUrlsMaxEntries`; each as `legacyReturnUrl`; duplicates marked | Cap. | `validation.tooMany`, `validation.duplicate` |
| `attributeMapping` | ≤ `attributeMappingMaxEntries`; each value 1 to `attributeValueMaxLength`, unique with letter case counting; template chosen | Cap. | `validation.tooMany`, `validation.required`, `validation.duplicate` |
| `defaultTemplate` | `null` or a template name of 1–255 characters | Contract | — |
| `syncInterval` | integer from `syncIntervalMinMinutes` to `syncIntervalMaxMinutes` | Cap. | `validation.outOfRange` |
| `clientSecret`, `bindPassword` | 1 to `secretMaxLength` when typed; required per the secret rule (§2) | Cap. | `validation.secretRequiredReason.<reason>`, `validation.tooLong` |
| Redirect URIs | per §2 "Redirect URI rule"; joined ≤ `redirectUrisMaxLength` | Oauth2 cap., Contract | `validation.required`, `validation.format.redirectUri`, `validation.tooLong`, `validation.duplicate` |
| OAuth2 search `q` | ≤ 255 | Contract | `validation.tooLong` |

## 7. State machines

### Single sign-on round trip

```text
[sign-in screen] ──tap──► (starting: busy, ceremony aborted)
   ▲                         │ 200: keep returnTo in sessionStorage → location.assign(authorizationUrl)
   │                         │ 409 not available: message, refetch public-config, action hidden
   │                         ▼
   │                 [provider's page] ──Back (bfcache: busy reset)──► [sign-in screen]
   │                         │ redirect to /ng/sso/return?…
   │                         ▼
   │   main.ts: capture code/state/error → history.replaceState(path only) → bootstrap
   │                         ▼
   │                 [return page] ──classify──► complete | providerError | unreportable | malformed | empty
   │                         │ complete: POST completion ──201──► session written, identity fetched,
   │                         │                                     broadcast → replace(kept address | home)
   │                         │          ──401/409/503/other──► [outcome message]
   │                         │ providerError: POST provider-error ──any──► [cancelled message]
   │                         │ unreportable: DELETE pending ──any──► [cancelled message]
   │                         │ malformed: DELETE pending ──any──► [state-invalid message]
   │                         │ empty: active session → home, otherwise → sign-in
   └── Back to sign-in (?returnTo=kept) ◄── [outcome message] ──Try again──► (starting) with kept address
```

### Setup flow (narrow screens)

```text
type ──Next (valid)──► connection ──Next──► return-addresses* ──Next──► sign-in ──Next──► review
  ▲  ◄──Back (push history)── … ◄──Back── …                                          │ Save
  │                                                                                   ▼
  │                                    201/200 → overview (announce) ; 409 → in-use message
  │                                    412 (change mode) → reload tag, keep entries ; 422 → errors per step
  └── leave with entries → confirm (useLeaveGuard) ; unmount → state and secret discarded
  * Keycloak and generic OIDC only
```

### Section edit

```text
read-only ──Edit──► editing (one section at a time) ──Cancel──► read-only (secret emptied)
                       │ Save: toPatch() null → read-only, no request
                       │ Save: PATCH If-Match ──200──► read-only (stored values, announced, secret emptied)
                       │                      ──412──► conflict (entries kept, changed values marked) ──Save again / Discard
                       │                      ──422──► editing (field errors, summary, secret emptied)
                       │                      ──404──► empty state ("removed elsewhere")
```

### Connection test

```text
idle ──Test──► pre-check: client errors or required secret missing → idle (fields marked, nothing sent)
               └─► running (busy, announced; 90 s timer) ──200──► result (outcome, category, address, time)
                                                         ──422──► idle (field errors)
                                                         ──network──► error (retry)
                                                         ──90 s──► noResult ("Test again")
result ──a dependency changes──► result (stale: "refers to earlier values")
any ──page or form unmounts──► discarded
```

### OAuth2 single-client actions

```text
detail ──action──► confirm (names client, counts, consequences)
   ──confirm──► request with If-Match ──success──► regenerate: credentials dialog │ revoke: counts 0 │ delete: list
                                     ──412──► refetch detail → confirm again with fresh values
                                     ──404──► not-found state with a link to the list
```

### Credentials dialog

This is UI 001's one-time secret state machine (001 data-model §7), as `OneTimeSecretDialog`
(UI 005). It adds the client ID as a second copyable value. Only an uncopied **secret** triggers
the close confirmation.

### OAuth2 bulk action

```text
list ──Select──► selecting (current page; at bulkLimit further selection is disabled, limit stated) ──page/filter/sort/size change──► cleared
selecting ──Revoke/Delete──► confirm (list + counts; delete: type the number)
   ──confirm──► POST bulk-actions { action, targets[{ id, version (etag without quotes) }] }
        ──200──► summary per item; failed/refused/outdated stay selected; list invalidated; Retry sends exactly
                 those with the refreshed list's version tags
        ──network──► "outcome unknown"; nothing retried; list invalidated
```

## 8. Legacy translation keys used verbatim

Constitution IV 1.3.0: the app uses these legacy keys by their legacy name, verbatim, through UI
001's legacy translation layer (runtime `/lang/` loader, `en-gb` snapshot of upstream `2026-09a`,
formatter). The "App key" column only names the element; there is no alias and no copy in
`src/i18n/messages/`. "sk" marks keys that the upstream `sk-sk` file lacks; they fall back to
`en-gb` as in the classic interface (the FeldHost fork's `sk-sk` has them) and are never written by
hand. T005a's legacy form map completes this table, including the messages.

| App key | Legacy key | sk |
|---|---|---|
| `identityProvider.title` | `admin.iam` | sk |
| `identityProvider.fields.serverUrl` | `admin.iam_server_url` | sk |
| `identityProvider.fields.realm` | `admin.iam_realm` | sk |
| `identityProvider.fields.clientId` | `admin.iam_client_id` | sk |
| `identityProvider.fields.clientSecret` | `admin.iam_client_secret` | sk |
| `identityProvider.fields.version` | `admin.iam_version` | sk |
| `identityProvider.fields.authorizationEndpoint` | `admin.iam_authorize_url` | sk |
| `identityProvider.fields.tokenEndpoint` | `admin.iam_token_url` | sk |
| `identityProvider.fields.userInfoEndpoint` | `admin.iam_userinfo_url` | sk |
| `identityProvider.fields.scopes` | `admin.iam_client_scopes` | sk |
| `identityProvider.fields.hosts` | `admin.iam_host` | sk |
| `identityProvider.fields.port` | `admin.iam_port` | sk |
| `identityProvider.fields.security.ssl` | `admin.iam_use_ssl` | sk |
| `identityProvider.fields.security.startTls` | `admin.iam_use_tls` | sk |
| `identityProvider.fields.security.sslHint` | `admin.iam_use_ssl_info` | sk |
| `identityProvider.fields.security.startTlsHint` | `admin.iam_use_tls_info` | sk |
| `identityProvider.fields.baseDn` | `admin.iam_basedn` | sk |
| `identityProvider.fields.usernameField` | `admin.iam_username_field` | sk |
| `identityProvider.fields.filter` | `admin.filter` | sk |
| `identityProvider.fields.attributeField` | `admin.iam_attribute_field` | sk |
| `identityProvider.fields.bindDn` | `admin.iam_binddn` | sk |
| `identityProvider.fields.bindPassword` | `admin.iam_bindpass` | sk |
| `identityProvider.fields.ignoreTlsErrors` | `admin.ignore_ssl_error` | sk |
| `identityProvider.fields.mapping` | `admin.iam_mapping` | sk |
| `identityProvider.fields.mappingAttribute` | `user.attribute` | sk |
| `identityProvider.fields.mappingTemplate` | `mailbox.template` | — |
| `identityProvider.fields.defaultTemplate` | `admin.iam_default_template` | sk |
| `identityProvider.fields.defaultTemplateHelp` | `admin.iam_default_template_description` | sk |
| `identityProvider.fields.mailpasswordFlow` | `admin.iam_rest_flow` | sk |
| `identityProvider.fields.createMailboxOnSignIn` | `admin.iam_login_provisioning` | sk |
| `identityProvider.fields.periodicSync` | `admin.iam_periodic_full_sync` | sk |
| `identityProvider.fields.importUsers` | `admin.iam_import_users` | sk |
| `identityProvider.fields.syncInterval` | `admin.iam_sync_interval` | sk |
| `identityProvider.test.action` | `admin.iam_test_connection` | sk |
| `identityProvider.test.success` | `success.iam_test_connection` | sk |
| `identityProvider.test.failure` | `danger.iam_test_connection` | sk |
| `identityProvider.inUse.title` | `danger.authsource_in_use` | sk |
| `identityProvider.abilities.singleSignOn` | `admin.iam_sso` | sk |
| `oauth2.title` | `admin.oauth2_apps` | — |
| `oauth2.add` | `admin.oauth2_add_client` | — |
| `oauth2.fields.clientId` | `admin.oauth2_client_id` (list), `edit.client_id` (client page) | — |
| `oauth2.fields.clientSecret` | `admin.oauth2_client_secret` (list), `edit.client_secret` (client page) | — |
| `oauth2.fields.redirectUri` | `admin.oauth2_redirect_uri` (list, create), `edit.redirect_uri` (client page) | — |
| `oauth2.actions.regenerate` | `admin.oauth2_renew_secret` | — |
| `oauth2.actions.revokeTokens` | `admin.oauth2_revoke_tokens` | — |
| `oauth2.fields.scope` | `edit.scope` | — |

These are also used verbatim, no longer rewritten (constitution IV 1.3.0, research R26):
`admin.iam_description`, `admin.oauth2_info` (markup through `SanitizedHtml.vue`),
`admin.iam_auth_flow_info`, `admin.iam_extra_permission` (product name as the installation's file
has it), `admin.iam_host_info` (with the legacy host input; plan "Deviations needing a decision"
item 1) and `admin.iam_redirect_url` (the redirect URL field). The sign-in action is labelled
`admin.iam_sso` ("Single Sign-On"), as on the classic login page; there is no `auth.sso.action`
key.
