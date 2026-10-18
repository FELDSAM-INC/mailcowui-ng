# Data Model: Administrators and Domain Administrators

**Feature**: `specs/007-administrators-domain-admins` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

This app owns no persistent data. This document defines what UI 007 adds to UI 001's data model:

- the API data it consumes, as generated types;
- the app-defined models derived from them;
- the query keys, freshness and invalidation;
- the client state (session store fields and cross-tab messages);
- the routes and list address parameters;
- the client-side validation rules;
- the state machines of the identity switch, acting, the landing, the one-time link and webmail.

Decisions are justified in [research.md](./research.md). Contract shapes are not restated: types
come from `src/api/generated/schema.ts` through `@/api` (UI 001 R7).

## 1. API data consumed

Generated root types, re-exported by `src/api/index.ts`.

| Type | Operation(s) | Used by | Notes |
|---|---|---|---|
| `Admin`, `AdminCreateRequest`, `AdminPatch` | `listAdmins`, `getAdmin`, `createAdmin`, `updateAdmin`, `deleteAdmin`, `suspendAdminSecondFactors` | administrators | `etag` per entry; `password` is write-only |
| `DomainAdmin`, `DomainAdminAssignment`, `DomainAdminCreateRequest`, `DomainAdminPatch` | `listDomainAdmins`, `getDomainAdmin`, `createDomainAdmin`, `updateDomainAdmin`, `deleteDomainAdmin`, `suspendDomainAdminSecondFactors` | administrators | `domains[].domainExists`; `domains` sent as ASCII strings |
| `DomainAdminPermissions`, `DomainAdminPermissionsPatch`, `DomainAdminPermissionName` | as above | permission editor | `domainAdminPermissionNameValues` drives the groups |
| `AccountSecondFactorStatus` | in `Admin` and `DomainAdmin`; list filter | badges, filters | `accountSecondFactorStatusValues` |
| `AccountCapabilities` | `getAccountCapabilities` | creation forms, bulk | defaults, `bulkLimit`, `usernameMaxLength`, `ssoTokenLifetime` |
| `AccountBulkActionRequest`, `BulkTarget`, `BulkResult`, `BulkItemResult`, `BulkItemOutcome` | `applyAdminBulkAction`, `applyDomainAdminBulkAction` | bulk bar, summary | `version` = the entry's `etag` |
| `DomainAdminSsoToken` | `issueDomainAdminSsoToken` | one-time link dialog | never cached; `Cache-Control: no-store` |
| `SsoTokenSignInRequest`, `SessionResponse` (`SessionCreated`) | `createSessionWithSsoToken` | landing | token write-only |
| `Impersonation`, `ImpersonationStartRequest`, `ImpersonationStarted` | `startImpersonation`, `endImpersonation` | acting | the start response carries `identity` and `csrfToken` |
| `Identity` (`impersonation`, `webmailOnBehalfEnabled`), `Session` (`impersonation`, `authMethod: ssoToken`) | `getIdentity`, `getSession` | banner, eligibility, guards | additive to UI 001 |
| `MailboxWebmailSignIn` | `createWebmailSignInOnBehalf` | webmail opener | `url` opened in the same browser |
| `AuditEvent` (`impersonatedAccount`), `AuditImpersonatedAccount` | `listAuditEvents` | audit log | new filter `impersonatedAccount` |
| `Domain` | `listDomains` | domain picker | `name` (ASCII), `unicodeName` |
| `PasswordPolicy` | `getPasswordPolicy` | password field (UI 003) | administrators may read it |
| `MailboxCapabilities` | `getMailboxCapabilities` | webmail eligibility | `groupwareEnabled` (UI 003's query) |
| `ImpersonationPermissionFlagProblem`, `Problem`, `ValidationProblem` | errors | problem mapping | `requiredFlags: [loginAs]` |

`getImpersonation` is not called: `Identity.impersonation` and `Session.impersonation` carry the same
data on every identity read.

## 2. App-defined models

These are not API shapes. Each is derived from API data or app constants.

### IdentityKey (`src/app/session/identity-key.ts`)

`identityKey(identity) = ` `` `${identity.username}|${identity.role}|${identity.impersonation?.id ?? ''}` ``.
Two identities are the same when their keys are equal (R4, R5).

### ActingState (`src/features/acting/composables/useActingState.ts`)

Derived from the cached identity:

| Field | Value |
|---|---|
| `isActing` | `identity.impersonation !== undefined` |
| `target` | `{ username, role }` of `impersonation.target` |
| `impersonator` | `{ username, role, authMethod }` of `impersonation.impersonator` |
| `startedAt` | `impersonation.startedAt` |

### Eligibility (`src/features/acting/eligibility.ts`)

`ActingTarget` = `{ kind: 'mailboxUser'; address: string; domain: string }` or
`{ kind: 'domainAdmin'; username: string }`.

| Function | True when |
|---|---|
| `canSignInAs(identity, target)` | not acting; no pending actions; role `admin` (any mailbox user or domain administrator); or role `domainAdmin`, target `mailboxUser`, `permissions.loginAs`, and `scope.type === 'domains'` contains `target.domain` |
| `canOpenWebmailAs(identity, target, groupwareEnabled)` | `canSignInAs` for a `mailboxUser` target, `identity.webmailOnBehalfEnabled === true` and `groupwareEnabled === true` |

### PermissionGroup (`src/features/administrators/permissions.ts`)

`PermissionGroup` = `'mailbox' | 'domain' | 'spamQuarantine' | 'access' | 'other'`. The map and
order are research R16. `groupPermissions(names)` returns the groups in order with their flags in
map order, and puts any name without a group in `other`. `changedFlags(base, current)` returns a
`DomainAdminPermissionsPatch` with only the differing flags (also used against the capabilities
defaults at creation).

### BulkPlan (`src/features/administrators/bulk.ts`)

`planBulk({ role, action, selected, identity, activeAdminCount })` returns:

| Field | Rule |
|---|---|
| `targets` | `BulkTarget[]` (`id` = username, `version` = etag) after the exclusions below |
| `excludedOwn` | `true` when the own administrator account was removed from a `delete` or `deactivate` |
| `skippedNoSecondFactor` | usernames left out of `suspendSecondFactors` because their status is not `active` |
| `blocked` | `'lastActiveAdmin'` when a `deactivate` of administrators would leave none active (selected active ≥ `activeAdminCount`); no request is sent |

### SsoLinkView (`src/features/administrators/sso-link.ts`)

`buildSsoLink(token) = new URL(router.resolve({ name: 'sign-in-sso-token', query: { sso_token:
token } }).href, location.origin).href`. Built only inside the dialog; never stored.

### ActingOrigin (`src/app/session/acting-origin.ts`)

`{ fullPath: string }`, the route at the time "Sign in as" was chosen. Memory only (R6).

## 3. Server-state cache

### Query keys (added to `src/api/query/keys.ts`)

| Key | Operation | staleTime | Fetched when | Notes |
|---|---|---|---|---|
| `['admins','list',AdminListParams]` | `listAdmins` | 30 s | administrator list | params from the address (§5) |
| `['admins','detail',username]` | `getAdmin` | 30 s | administrator detail | mutations write it |
| `['admins','active-count']` | `listAdmins` `{active:true,limit:1}` | 30 s | administrator list and detail | `meta.total` (R12) |
| `['domain-admins','list',DomainAdminListParams]` | `listDomainAdmins` | 30 s | domain administrator list | params from the address (§5) |
| `['domain-admins','detail',username]` | `getDomainAdmin` | 30 s | domain administrator detail | mutations write it |
| `['capabilities','accounts']` | `getAccountCapabilities` | 5 min | creation forms; bulk bar | defaults and limits |
| `['domains','picker',{q}]` | `listDomains` `{q,sort:'name',order:'asc',limit:25}` | 30 s | picker dialog open and typing (300 ms) | `useInfiniteQuery`, `offset` paging |
| UI 003's password policy and mailbox capabilities keys | `getPasswordPolicy`, `getMailboxCapabilities` | as UI 003 | password field; mailbox entries | reused |
| `['audit-events','list',AuditListParams]` | `listAuditEvents` | 30 s | audit log | gains `impersonatedAccount` |

`AdminListParams` and `DomainAdminListParams` are aliases of
`NonNullable<operations['listAdmins']['parameters']['query']>` and
`NonNullable<operations['listDomainAdmins']['parameters']['query']>`.

### Invalidation after mutations

| Mutation | On success | On 412 |
|---|---|---|
| `createAdmin`, `createDomainAdmin` | write `[…,'detail',username]`; invalidate `[…,'list']`; for administrators `['admins','active-count']` | — |
| `updateAdmin`, `updateDomainAdmin` | write `[…,'detail',username]` (the new name after a rename, and remove the old key); invalidate `[…,'list']`; for an administrator status change `['admins','active-count']` | keep the input; refetch the detail; mark the changed values (UI 002 `EditableSection`) |
| `suspendAdminSecondFactors`, `suspendDomainAdminSecondFactors` | write the detail; invalidate the list | refetch; offer the action again |
| `deleteAdmin`, `deleteDomainAdmin` | remove the detail; invalidate the list; for administrators the active count | refetch; confirm the removal again (conventions) |
| `applyAdminBulkAction`, `applyDomainAdminBulkAction` | invalidate `[…,'list']`, `[…,'detail']` of the `done` items and, for administrators, the active count | per item: `outdated` stays selected |
| `startImpersonation`, `endImpersonation` | identity switch: clear everything (R4) | — |
| `createSessionWithSsoToken` | write `session`; the identity switch or UI 001's after-sign-in path | — |
| `issueDomainAdminSsoToken`, `createWebmailSignInOnBehalf` | nothing is cached | — |
| `updateAdmin` of the own username | identity switch `selfRenamed` | — |

## 4. Client state

### Pinia: `useSessionStore` additions (`src/app/session/store.ts`)

| Field | Type | Lifetime | Rule |
|---|---|---|---|
| `identityTransition` | `boolean` | memory | `true` from step 1 to step 7 of the identity switch; layouts render the switching status instead of `<RouterView>` |
| `actingOrigin` | `ActingOrigin \| null` | memory | set when "Sign in as" is chosen; cleared on every other switch (R6) |
| `shellNotice` | `{ key: 'actingEndedByServer' \| 'changedInAnotherTab'; refusedWrite: boolean; target?: string } \| null` | memory, until dismissed or the next navigation | shown by `ShellNotice.vue`, announced (assertive) |
| `notice` (UI 001) | adds `'ssoLinkInvalid' \| 'selfDeactivated'` | one-shot | shown on the sign-in screen |

The sign-in token captured by the landing lives in a module-level variable of
`src/features/auth/sso-token-capture.ts`, cleared after the exchange or the "Stay signed in" choice.
Issued links live in the dialog's local state; passwords in the form's local state.

### Device storage

Nothing is added. UI 001 data-model §4 stays the complete list (constitution V); T121 asserts it
after the flows of this feature.

### Cross-tab messages

No new message. `{ v: 1, type: 'session-changed' }` (UI 001) is now also sent after a start or end
of acting, after a one-time link replaced a session and after a self-rename. Receivers run the
identity switch with `changedInAnotherTab` (R4), which also refreshes their anti-forgery token.

## 5. Routes and list parameters

### Route map (base `/ng/`)

| Name | Path | Layout | Access | Title key | Component (lazy) |
|---|---|---|---|---|---|
| `administrators` | `/administrators` | shell | nav `administrators` | — | redirect to `domain-admins` with the query |
| `domain-admins` | `/administrators/domain-admins` | shell | nav `administrators` | `domainAdmins.title` | `features/administrators/pages/DomainAdminsPage.vue` |
| `domain-admin-create` | `/administrators/add-domain-admin` | shell | nav `administrators` | `domainAdmins.create.title` | `…/DomainAdminCreatePage.vue` |
| `domain-admin-detail` | `/administrators/domain-admins/:username([A-Za-z0-9._-]{1,255})` | shell | nav `administrators` | `domainAdmins.detail.title` | `…/DomainAdminDetailPage.vue` |
| `admins` | `/administrators/admins` | shell | nav `administrators` | `admins.title` | `…/AdminsPage.vue` |
| `admin-create` | `/administrators/add-admin` | shell | nav `administrators` | `admins.create.title` | `…/AdminCreatePage.vue` |
| `admin-detail` | `/administrators/admins/:username([A-Za-z0-9._-]{1,255})` | shell | nav `administrators` | `admins.detail.title` | `…/AdminDetailPage.vue` |
| `sign-in-sso-token` | `/sign-in/sso-token` | auth | any session state (`meta.anySessionState`) | `ssoSignIn.title` | `features/auth/pages/SsoTokenLandingPage.vue` |

UI 014 maps `/edit/domainadmin/{username}` to `domain-admin-detail`, `/edit/admin/{username}` to
`admin-detail`, `/admin/system` to `administrators`, and any classic domain administrator address
with `sso_token` to `sign-in-sso-token` with that parameter.

### Address parameters (`useListState` schemas in `src/features/administrators/list-state.ts`)

Defaults are omitted from the address; invalid values fall back to the default (UI 001 §5).

**Domain administrators** (`/administrators/domain-admins`):

| Param | Type | Default | Maps to |
|---|---|---|---|
| `q` | string ≤ 255 | — | `q` |
| `status` | `active`, `inactive` | — | `active` (`true`/`false`) |
| `tfa` | `none`, `active`, `suspended` | — | `secondFactorStatus` |
| `pending` | `passwordChange`, `secondFactorSetup` | — | `forcePasswordChange=true` or `forceSecondFactorSetup=true` |
| `domain` | repeatable string ≤ 255, ≤ 100 | — | `domain` (exploded) |
| `permission` | `DomainAdminPermissionName` | — | `permission` |
| `permissionValue` | `on`, `off` | `on` | `permissionValue` (only with `permission`) |
| `sort` | `username`, `active`, `createdAt`, `modifiedAt`, `domainCount` | `username` | `sort` |
| `order` | `asc`, `desc` | `asc` | `order` |
| `page` | integer ≥ 1 | 1 | `offset = (page − 1) × size` |
| `size` | 25, 50, 100 | 25 | `limit` |

**Administrators** (`/administrators/admins`): `q`, `status`, `tfa`, `pending`, `sort`
(`username`, `active`, `createdAt`, `modifiedAt`), `order`, `page`, `size`, mapped as above.

**Audit log** (UI 001 §5) gains `impersonated` (string ≤ 255) → `impersonatedAccount`.

## 6. Client-side validation

Server field errors are always shown too (FR-016). Limits come from `AccountCapabilities` where the
API reports them (conventions).

| Field | Rule | Message key |
|---|---|---|
| Username (create, rename) | trimmed and lower-cased on blur; required; ≤ `usernameMaxLength`; only `a-z 0-9 . _ -`; at least one letter or digit; not `api` | `validation.required`, `validation.tooLong`, `validation.format.accountUsername`, `accounts.validation.reservedUsername` |
| Password (create) | required; ≤ 4,096 characters; the policy rules shown, checked before submission | `validation.required`, `validation.tooLong`, UI 003's policy messages |
| Password (edit) | empty keeps the password; otherwise as at creation | as above |
| Domains (create, edit) | at least one selected; entries with `domainExists: false` are not part of the edit selection | `domainAdmins.validation.domainRequired` |
| Bulk selection | ≤ `bulkLimit`; administrators' `deactivate` blocked when it would leave none active | `accounts.bulk.limit`, `admins.reason.lastActiveAdmin` |
| Impersonated account filter | ≤ 255 characters | `validation.tooLong` |
| Landing token | present in the address; nothing else is checked by the client | — |

## 7. State machines

### Identity switch (`app/session/identity-switch.ts`)

```text
idle ─trigger→ unmounting ─nextTick→ clearing ─→ renewing token ─→ reading identity+session ─→ routing ─→ idle
                                                     │ network             │ network / 401
                                                     └──── retry screen ◄──┘ (401: session ended, UI 001 R11)
```

The layouts show the switching status from `unmounting` to `routing`. Triggers and targets are in
research R4.

### Acting lifecycle (`features/acting`, `app/session`)

```text
own identity ──Sign in as (201)──► acting ──Return (204)──────────────► own identity at origin or home
     ▲                               │ ──403 impersonation-ended──────► own identity at origin or home + notice
     │                               │ ──Sign out completely──────────► signed out (UI 001)
     │                               │ ──session-changed (other tab)──► the identity the API reports
     └── refusal (409/403/404): message, stays own identity
```

### One-time sign-in landing (`features/auth`)

```text
captured(token) ──visible & not prerendering──► check session
   anonymous ─────────────────────────────────► exchanging
   active | restricted | pendingSecondFactor ─► asking ──Continue──► exchanging
                                                  └─Stay signed in─► home (token discarded)
exchanging ──201──► restricted: pending actions | active: home   (token cleared)
           ──401 / 422──► sign-in with notice ssoLinkInvalid       (token cleared)
           ──429──► throttled message with countdown + normal sign-in link (token cleared)
           ──network──► error with "Try again" (token kept in memory)
no token ──► sign-in
```

### One-time link dialog (`OneTimeSecretDialog` with `expiresAt`)

```text
shown(link, expiresAt) ──copy──► copied ──close──► closed (link cleared)
   │ countdown 0 ─► expired (copy disabled; "Create new link" ─► new request ─► shown)
   └──close uncopied & not expired ─► confirm ──yes─► closed │ no ─► shown
```

### Webmail on behalf (`features/acting/webmail-opener.ts`)

```text
idle ─choose─► requesting ─200─► opening ─window─► idle (tab opened, opener cleared)
                   │                  └─null (blocked)─► link shown ─tap─► idle
                   └─refusal─► message (no tab opened)
```
