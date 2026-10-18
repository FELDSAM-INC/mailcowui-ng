---
description: "Task list for UI feature 007: administrators and domain administrators"
---

# Tasks: Administrators and Domain Administrators

**Input**: Design documents from `specs/007-administrators-domain-admins/`:
- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/README.md](./contracts/README.md)
- [quickstart.md](./quickstart.md)

**Prerequisites**: UI 001 to UI 006 are implemented (their shared blocks, under the canonical names
of `docs/conventions.md`, are listed in research R22), and the contract pin contains API 007 (T001).
API 007's implementation is needed only for the smoke run (T115).

**Tests**: Mandatory (constitution VI, test-first). In every phase, tests are written first and must
fail before the implementation tasks that follow them. Every end-to-end spec:
- runs on the `mobile-chromium` (360 px), `desktop-chromium` and `mobile-webkit` projects;
- calls `expectAccessible` (axe, WCAG 2.2 AA, both themes) on every screen, dialog and state it
  reaches, and `expectNoHorizontalScroll` and `expectTouchTargets` on the mobile projects;
- fails on any CSP violation, mock contract violation or visible sentinel problem `detail` (UI 001
  fixtures and T008);
- names its spec reference in the test title (`US2-AS3 …`, `FR-052 …`, `SC-004 …`, `Edge: …`).

**Secrets rule**: requests that carry a password or a sign-in token, and responses that carry a
one-time link, run through the canonical `useSecretRequest` (UI 001, UI 005), whose values stay in
component state and whose problems reach `dispatchProblemReactions()`; they never go through
`useQuery` or `useMutation`, and no form draft of them is saved (`docs/conventions.md`).

**Organization**: Tasks are grouped by user story (spec priorities P1 to P3), so that each story can
be implemented and tested on its own once the foundation is in place.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1 to US7)
- Paths are relative to the repository root `mailcowui-ng/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: A contract pin that contains API 007, its types, the translation scope and the visual
tokens (research R1, R7, R17).

- [ ] T001 Check the contract pin (research R1, [contracts/README.md](./contracts/README.md)). Pins only move forward:
  - Read `contract/VERSION.json`. When its `commit` is `32079252d55797d3da4e58ae661e9fb91c51c6f9` or newer (it contains API 007's `a13c370` and the API 004 and 005 contracts), keep it, and run `git -C ../mailcow-rest-v2 diff 32079252d55797d3da4e58ae661e9fb91c51c6f9 <pin> -- api/modules/admins api/modules/domain-admins api/modules/sso-tokens api/modules/impersonation api/modules/audit` plus the components named in contracts/README.md; any change to this feature's 28 operations is handled as a deliberate bump (fix the types and tests).
  - When it is older, run `scripts/contract/bump.sh 32079252d55797d3da4e58ae661e9fb91c51c6f9`, which rewrites `contract/openapi.yaml`, `contract/openapi.json`, `contract/VERSION.json` and `src/api/generated/schema.ts`, and confirm the bundle sha256 `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6`. Never pin "the latest commit".
  - Confirm that `schema.ts` exports `domainAdminPermissionNameValues`, `accountSecondFactorStatusValues` and `knownProblemTypeValues`, then run `npm run typecheck && npm run test:unit && npm run test:e2e` and fix what a bump broke in earlier features (constitution I).
- [ ] T002 Re-export the new generated root types and enumeration arrays from `src/api/index.ts`: `Admin`, `AdminCreateRequest`, `AdminPatch`, `DomainAdmin`, `DomainAdminAssignment`, `DomainAdminCreateRequest`, `DomainAdminPatch`, `DomainAdminPermissions`, `DomainAdminPermissionsPatch`, `DomainAdminPermissionName`, `AccountSecondFactorStatus`, `AccountCapabilities`, `AccountBulkActionRequest`, `BulkTarget`, `BulkResult`, `BulkItemResult`, `BulkItemOutcome`, `DomainAdminSsoToken`, `SsoTokenSignInRequest`, `Impersonation`, `ImpersonationStartRequest`, `ImpersonationStarted`, `ImpersonationPermissionFlagProblem`, `MailboxWebmailSignIn`, `AuditImpersonatedAccount`, and `domainAdminPermissionNameValues`, `accountSecondFactorStatusValues`, `knownProblemTypeValues` (skip those an earlier feature already exports). No hand-written API type (constitution I). `npm run typecheck` must pass.
- [ ] T003 [P] Extend `tests/unit/scripts/i18n-tools.spec.ts` (UI 001 T020) with cases for the two new fully checked enumerations: a missing `permissions.flag.<name>` key for a `DomainAdminPermissionName` value, or a missing `accounts.secondFactorStatus.<value>` key for an `AccountSecondFactorStatus` value, fails the check. The new cases must fail.
- [ ] T004 Add `DomainAdminPermissionName` (keys `permissions.flag.<name>`) and `AccountSecondFactorStatus` (keys `accounts.secondFactorStatus.<value>`) to the fully checked enumerations of `scripts/i18n/check.mjs`, reading the arrays from `src/api/generated/schema.ts`, so that T003 passes.
- [ ] T005 [P] Translation scope of the shared enumerations (research R17):
  - First write `tests/unit/i18n/legacy-keys-007.spec.ts`, which asserts that each legacy key it lists is a value of `src/i18n/legacy-map.json`, starting with `warning.no_active_admin` and `warning.cannot_delete_self`. It must fail. Later stories add their keys to it.
  - Append to UI 002's manifest `src/i18n/coverage.json`: the 12 `AuditEventType` values of API 007 (`adminCreation`, `adminUpdate`, `adminDeletion`, `adminSecondFactorSuspension`, `domainAdminCreation`, `domainAdminUpdate`, `domainAdminDeletion`, `domainAdminSecondFactorSuspension`, `ssoTokenIssue`, `impersonationStart`, `impersonationEnd`, `webmailSignInOnBehalf`), the `AuditTarget.type` values `admin`, `domainAdmin`, `ssoToken`, `impersonation`, the `AuthMethod` value `ssoToken`, the problem types `account-exists`, `last-active-admin`, `cannot-delete-own-account`, `already-impersonating`, `impersonation-ended`, `not-allowed-while-impersonating`, `webmail-on-behalf-disabled`, `account-inactive` and, when not yet listed, `permission-flag-required`, `groupware-disabled` and `session-required`, and the rule codes `reserved`, `immutable`, `unknownField` and `notEligible` when not yet listed.
  - Add their messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`: `auditLog.event.<type>`, `auditLog.target.<type>`, `auditLog.authMethod.ssoToken`, `problem.<name>` (with `problem.not-allowed-while-impersonating` = "Not available while acting as another user", and `problem.last-active-admin` and `problem.cannot-delete-own-account` mapped to the legacy `warning.no_active_admin` and `warning.cannot_delete_self` in `src/i18n/legacy-map.json`), and `validation.<code>` where missing. Run `npm run i18n:import`; the legacy-key test and `npm run i18n:check` must pass.
- [ ] T006 [P] Add the acting colour tokens `--color-acting-bg`, `--color-acting-fg` and `--color-acting-border` for both themes (an amber treatment distinct from the header, AA contrast in light and dark) and the variable `--shell-sticky-height` used by `scroll-padding-top` to `src/styles/main.css` (research R7). Add the inline-SVG icons `UserSwitchIcon.vue`, `ShieldOffIcon.vue` and `LinkIcon.vue` to `src/shared/icons/` and its barrel `src/shared/icons/index.ts` (TailAdmin first, otherwise Lucide, recorded in `THIRD_PARTY_NOTICES.md`).

**Checkpoint**: The pinned contract contains API 007, its types are importable from `@/api`, and
`npm run i18n:check` covers the feature's enumerations and its shared-enumeration values.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The mock state for accounts and impersonation, the sentinel problem text, and the
identity-switch core that acting (US2), the self-rename (US4) and the one-time link (US5) need: the
switch protocol, the changed anti-forgery retry, the `impersonation-ended` reaction, the cross-tab
change and the shell notice (research R4, R5, R19, R20).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Test infrastructure

- [ ] T007 [P] Extend the mock scenario model and add factories (research R20):
  - `tests/mocks/scenarios/state.ts`: `admins` and `domainAdmins` (username, active, forced flags, created and modified times, second factors as `none`/`active`/`suspended` entries, active passkey count, a version counter for the `etag`), domain administrator `assignments` (domain, active, created, `domainExists`) and `permissions` (the 19 flags, or `null` for a missing record), `accountDefaults` (the 19 defaults of API 007 FR-037, `bulkLimit` 100, page sizes 25 and 1000, `usernameMaxLength` 255, `ssoTokenLifetime` 30), `ssoTokens` (token, username, issued at, used), `session.impersonation` (id, impersonator with role and auth method, target with role, started at), the settings `allowAdminEmailLogin` and `groupwareEnabled`, and the flag `invalidateImpersonation`;
  - `tests/mocks/factories/admin.ts`, `tests/mocks/factories/domain-admin.ts` (representations built from the state, with `etag` derived from username, status, forced flags, assignments, permissions and the version counter) and `tests/mocks/factories/impersonation.ts` (an `Impersonation` with a ULID `id`).
- [ ] T008 [P] Sentinel problem text (SC-008, research R20): make the mock's shared problem builder (the helper every handler in `tests/mocks/handlers/` uses to build problem bodies; create `tests/mocks/handlers/problem.ts` when there is none) put `"[mock English detail]"` in every problem's `detail`, and make `tests/e2e/fixtures/test.ts` fail a test after each step when that text is visible on the page. Write `tests/unit/mocks/problem-sentinel.spec.ts` first: a built problem carries the sentinel and still validates against the contract.

### Tests for the core (write first; must fail)

- [ ] T009 [P] Write `tests/unit/app/session/identity-key.spec.ts` and `tests/unit/app/session/acting-origin.spec.ts` (data-model §2):
  - the key is `username|role|impersonation.id` and differs when only the impersonation ID changes;
  - the origin keeps the route's `fullPath` (path and query), is cleared on every switch except a start, and is never written to `localStorage`, `sessionStorage` or `history.state`.
- [ ] T010 [P] Write `tests/unit/app/session/identity-switch.spec.ts` (research R4). For each reason of the R4 table it must check:
  - `identityTransition` becomes `true` and the layout's `<RouterView>` content is unmounted **before** `queryClient.cancelQueries()`, the mutation cache clear and `queryClient.clear()` run;
  - the anti-forgery token comes from the response when given (start), otherwise from one single-flight `GET /csrf-token`;
  - the identity comes from the argument when given, otherwise from `GET /me`; then `GET /session` runs;
  - `session-changed` is broadcast except for `changedInAnotherTab`;
  - the target: the acting origin for `actingEnded` and `actingEndedByServer`, the current route for `changedInAnotherTab`, the new name for `selfRenamed`, and `home` whenever `canAccess` denies the target;
  - the announcement or shell notice of each reason, with `refusedWrite` adding "your last action was not carried out";
  - a network failure of steps 3 or 4 shows the retry state and never re-mounts the previous page; a `401` runs UI 001's session end.
- [ ] T011 [P] Change `tests/unit/api/client.spec.ts` (UI 001 T030) for research R5: after `403 csrf-token-mismatch`, the client fetches a token and calls `GET /me`; with an equal identity key it replays the original request once (the existing FR-035 case); with a different key it does **not** replay, calls the registered identity-change handler with `refusedWrite: true`, and rejects with an `ApiProblem` of `kind: 'identityChanged'`; a `401` from `GET /me` ends the session; a second mismatch after a replay ends the session. The new cases must fail.
- [ ] T012 [P] Change `tests/unit/api/query-client.spec.ts` (UI 001 T030, extended by UI 005 for `dispatchProblemReactions()`): a problem of type `/api/v2/problems/impersonation-ended` passed to `dispatchProblemReactions()`, from a query, a mutation or `useSecretRequest`, calls `switchIdentity({ reason: 'actingEndedByServer' })` once, and the request is never retried.
- [ ] T013 [P] Write `tests/unit/app/session/cross-tab-identity.spec.ts` (research R4): a received `session-changed` re-reads `GET /me`; a different identity key runs `switchIdentity({ reason: 'changedInAnotherTab' })`; an equal key (another tab lifted a restriction) keeps UI 001's refetch of `session` and `identity` with no notice and no unmount; an identity refresh whose key differs runs the switch too; no request is made on `visibilitychange` (UI 001 FR-033).
- [ ] T014 [P] Write `tests/unit/app/shell/ShellNotice.spec.ts` and `tests/unit/app/layouts/identity-transition.spec.ts`:
  - `ShellLayout.vue` and `AuthLayout.vue` render the "Switching account…" status (`role="status"`) instead of `<RouterView>` while `identityTransition` is `true`;
  - `ShellNotice.vue` shows `shellNotice` at the top of the main content, is announced in the assertive region, can be dismissed with a labelled 44 × 44 px button, and is cleared by the next navigation.

### Core implementation

- [ ] T015 Implement `src/app/session/identity-key.ts`, `src/app/session/acting-origin.ts`, the session store fields `identityTransition`, `actingOrigin` and `shellNotice` and the notices `ssoLinkInvalid` and `selfDeactivated` in `src/app/session/store.ts` (data-model §4), and the `ApiProblem` kind `'identityChanged'` in `src/api/problem.ts`, so that T009 passes.
- [ ] T016 Implement `src/app/session/identity-switch.ts` (the seven steps of research R4), so that T010 passes. Replace UI 001's username-and-role comparison in `src/app/session/cross-tab.ts` with `identityKey`.
- [ ] T017 Implement the identity check before a replay and `setIdentityChangeHandler()` in `src/api/csrf.ts`, and register the handler from `src/app/session` at bootstrap in `src/app/bootstrap.ts` (research R5), so that T011 passes.
- [ ] T018 Add the `impersonation-ended` reaction to `dispatchProblemReactions()` in `src/api/query/client.ts` (the dispatcher both caches' `onError` hooks and `useSecretRequest` call), and the key roots `admins`, `domain-admins` and `capabilities.accounts` of data-model §3 to `src/api/query/keys.ts`, with the list parameter types aliased from the generated `operations['listAdmins' | 'listDomainAdmins']['parameters']['query']`, so that T012 passes.
- [ ] T019 Make `src/app/session/cross-tab.ts` re-read the identity on `session-changed` and run the switch only when the key differs, so that T013 passes.
- [ ] T020 [P] Align UI 001's documents with research R4 and R5, as `docs/conventions.md` asks of the next change to a spec: in `specs/001-sign-in-app-shell/spec.md` FR-035 (retry once only when the identity is unchanged) and FR-037 (the identity key), and the navigation catalogue table (the row "Administrators and domain administrators" becomes the rows `domainAdmins` and `administrators`, as UI 004 did for its rows); in `specs/001-sign-in-app-shell/research.md` R8 and R12 a note that points to UI 007 research R4 and R5; and in `specs/001-sign-in-app-shell/data-model.md` §2 the two catalogue rows.
- [ ] T021 Implement `src/app/shell/ShellNotice.vue` and the transition gate and notice placement in `src/app/layouts/ShellLayout.vue` and `src/app/layouts/AuthLayout.vue`, so that T014 passes.
- [ ] T022 Add the messages `session.switching`, `acting.notice.endedByServer`, `acting.notice.changedInAnotherTab`, `acting.notice.writeNotCarriedOut` and `shellNotice.dismiss` to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. `npm run i18n:check` must pass.

**Checkpoint**: All Phase 2 tests pass. Any identity change in the app unmounts, clears, renews and
re-renders as research R4 describes; the user stories can start.

---

## Phase 3: User Story 1 - Manage domain administrators and their domains (Priority: P1) 🎯 MVP

**Goal**: The domain administrator list (cards and table, search, filters, sorts, paging), the
creation form with domains, sign-in requirements and permissions, the detail screen with its
Account, Domains and Sign-in and security sections, status changes, second-factor suspension,
removal and bulk actions.

**Independent Test**: Against the mock, as an administrator at 360 px and desktop, list, search,
filter, create, edit, rename, suspend second factors of and remove domain administrators, and check
every request, every field error and every loading, empty and error state.

### Tests for User Story 1 (write first; must fail)

- [ ] T023 [US1] Implement the domain administrator handlers and scenarios (research R20):
  - `tests/mocks/handlers/domain-admins.ts`:
    - `listDomainAdmins`: `q` over the username and the ASCII and Unicode domain names, `active`, `secondFactorStatus`, `forcePasswordChange`, `forceSecondFactorSetup`, repeated `domain` (≤ 100), `permission` with `permissionValue` (default `true`; a missing record counts as every flag `false`), the sorts `username`, `active`, `createdAt`, `modifiedAt`, `domainCount` with ties by username, `order`, `limit` (default 25, max 1000), `offset`, `meta.total`;
    - `createDomainAdmin`: username trimmed and lower-cased, then `invalidFormat` (`format: accountUsername`) unless only `a-z 0-9 . _ -` with at least one letter or digit, `tooLong` above 255, `reserved` for `api`; `409 account-exists` across both roles, case-insensitively; domains normalised, `notFound`, `notEligible` and `invalidFormat` (`format: domainName`) on `domains.<i>`, duplicates merged; feature 003's password policy codes, except for a value with a hash-scheme prefix; unsent permission flags get `accountDefaults`; `201` with `Location` and `ETag`;
    - `getDomainAdmin` (any letter case; an administrator's name is `404`);
    - `updateDomainAdmin`: JSON Merge Patch, `If-Match`/`412`, `immutable` for changed read-only members, `unknownField`, the rename rules and `409`, `domains` replacing the set (at least one, existing assignments keep their times and status, non-domain assignments dropped, `notFound` for a removed domain), `permissions` merge (creating a missing record with unsent flags `false`), `active` applied to the assignments; `ETag` on `200`;
    - `deleteDomainAdmin` (`If-Match`/`412`, `204`) and `suspendDomainAdminSecondFactors` (`If-Match`/`412`; `active` entries become `suspended`; passkeys unchanged);
    - `applyDomainAdminBulkAction`: `tooMany` (with `max`) above `bulkLimit`, items in order, each once, outcomes `done` (with the new `version`), `notFound`, `outdated` (`412` problem), `failed`, and the `summary`;
  - `tests/mocks/handlers/admins.ts` with `getAccountCapabilities` from `accountDefaults` (the administrator operations follow in T071);
  - register both in `tests/mocks/handlers/index.ts`;
  - `tests/mocks/scenarios/administrators.ts`, registered in `tests/mocks/scenarios/index.ts`: `domain-admins-three` (an admin session and three domain administrators, one with active second factors), `domain-admins-empty`, `domain-admins-many` (120 domain administrators and 3,000 domains, one account with 40 domains), `domain-admins-edge` (an account without domains, one with an `ALL` assignment, one whose assignment status differs from the account's, one without a permission record, one with a 255-character username), `domain-admins-list-error` (`500` on `listDomainAdmins`), `domain-admin-detail-error` (`500` on `getDomainAdmin`), `capabilities-unavailable` (`500` on `getAccountCapabilities`), `capabilities-bulk-limit-2` (`bulkLimit` 2), `domain-admin-changed-elsewhere` (the account changes after it is read), `domain-admin-domain-removed` (a picked domain disappears before the save) and `domain-admins-as-domain-admin` (a domain administrator session).
- [ ] T024 [P] [US1] Write `tests/e2e/administrators/domain-admins-list.spec.ts`:
  - US1-AS1 and FR-006: at 360 px three cards with username, assigned domains, two-factor status and status, the whole card opening the detail, no horizontal scrolling; on desktop a table with sortable headers (`aria-sort`);
  - US1-AS2 and FR-007: a search for part of a domain name narrows the list and survives opening an account and coming back; every filter (status, two-factor status, pending requirement, assigned domain, permission flag value), every sort and the pagination with the total are kept in the address, survive a reload, and are sent as the contract's parameters (asserted through `mockApi.requests()`);
  - FR-005: the first three domains and "+N more", the "No domains" warning, the "not a domain" marker, two-factor "suspended until next sign-in"; status and two-factor status as text (FR-069);
  - FR-008: "Add domain administrator" reachable with one tap at 360 px;
  - US1-AS9: the empty state explains domain administrators and offers "Add domain administrator"; with filters, "No matches" and "Clear filters";
  - US1-AS10 and FR-004: the loading state, then on `domain-admins-list-error` the translated error with a retry, while the navigation keeps working;
  - FR-001: on `domain-admins-as-domain-admin`, neither "Domain administrators" nor "Administrators" is in the navigation, and `/ng/administrators/domain-admins` shows UI 001's "no access" state with no `listDomainAdmins` request;
  - research R3: the navigation entry "Domain administrators" opens `/ng/administrators/domain-admins`; `/ng/administrators` redirects there with its query; `/ng/administrators/domain-admins/-/new` opens the creation form;
  - Edge (many domains): a card of an account with 40 domains shows three and "+37 more".
- [ ] T025 [P] [US1] Write `tests/e2e/administrators/domain-admin-create.spec.ts`:
  - US1-AS3 and FR-017: a username, two domains from the picker, a generated password, "unlimited quota" turned off in the Permissions section, save: the request body holds `permissions: { unlimitedQuota: false }` only, a translated success message names the account, and its detail screen opens (asserted with `mockApi.requests()`);
  - US1-AS4 and FR-012: no domain, and a username with characters other than `a–z`, `0–9`, `-`, `_` and `.`, each block saving with a message on the field; `api` in any case is refused; on blur ` Reseller.One ` becomes `reseller.one`, with the hint about allowed characters;
  - US1-AS4 and FR-014: a password missing a policy rule shows the rule as not met while typing and does not block saving; the API's refusal then names the rule on the password field; a value with a hash-scheme prefix shows the pre-hashed notice;
  - US1-AS5: an existing username in another case shows "already exists" on the username field and keeps every value;
  - FR-011: the sections Account (active on by default), Domains, Sign-in requirements (both off) and Permissions, as a full page at 360 px;
  - FR-013: at 360 px the picker opens full screen with a search field and checkboxes; "Load more" pages through 3,000 domains (`domain-admins-many`); the selection shows as removable chips; Escape discards;
  - FR-014: show and hide, "Generate" fills a policy-conforming password, reveals it and offers to copy; leaving the page (through the leave guard) and coming back shows an empty field;
  - FR-015: Permissions starts collapsed with the defaults from the capabilities and a note; on `capabilities-unavailable` the section shows an error with a retry and the form still saves without `permissions`;
  - FR-016 and Edge (domain removed while the form is open): on `domain-admin-domain-removed` the save shows a field error naming the removed domain on its chip and keeps the other values;
  - Edge (network failure during a save): `route.abort()` keeps the values, shows a translated network error with a retry, and reports nothing as saved;
  - SC-001: the whole creation at 360 px with keyboard and touch completes in under 2 minutes of test time without horizontal scrolling.
- [ ] T026 [P] [US1] Write `tests/e2e/administrators/domain-admin-detail.spec.ts`:
  - FR-018: the sections Account, Domains and Sign-in and security, with creation and modification dates in the user's locale; at 360 px a section index leads to each; `?edit=domains` opens the Domains section in edit mode after a reload (FR-003);
  - US1-AS6 and FR-022: add a domain and remove another, save: the request holds exactly the new set as ASCII names with `If-Match`; an empty selection is refused visibly; each domain links to UI 002's domain screen; a non-domain assignment shows its warning and is not part of the edit selection; a differing assignment status shows its own badge;
  - FR-019 and FR-070: each section saves only its changed fields with the etag read and announces the result; leaving with unsaved changes asks for confirmation;
  - FR-020 and FR-021: a rename confirms that the account's open sessions and any acting session on it end, then the address shows the new name; "Set a new password" sends `{ password }` once with `If-Match` and clears the field; leaving it empty sends nothing;
  - FR-023: the two forced flags with their explanations, the product name taken from the branding configuration;
  - US1-AS7 and FR-024: "Suspend two-factor authentication until next sign-in" asks for a confirmation that states password-only sign-in until the next sign-in and that passkeys keep working, and sends `If-Match`; afterwards the status shows "suspended until next sign-in"; on `domain-admin-changed-elsewhere` the suspension's `412` reloads and offers the action again (FR-066);
  - FR-026: activating needs no confirmation; deactivating asks once, stating that the sessions end and the API keys stop working until reactivation; the result message states the effect; a refusal restores the previous state;
  - FR-066 and Edge (concurrent edit): on `domain-admin-changed-elsewhere` a section save explains the account was changed elsewhere, keeps the input, marks the changed values and offers the current values;
  - Edge (domain removed while editing the Domains section): on `domain-admin-domain-removed` the save names the removed domain on its chip;
  - Edge (network failure during a section save): the input stays, a translated error with a retry appears, and nothing is reported as saved;
  - Edge: the account without a permission record and the one without domains open normally, with their warnings;
  - Edge (removed with its last domain): an unknown username shows `NotFoundState` with a link back to the list, and a removed account disappears from the list on the next load;
  - FR-004: the detail's loading state, and on `domain-admin-detail-error` the error with a retry.
- [ ] T027 [P] [US1] Write `tests/e2e/administrators/domain-admin-remove-and-bulk.spec.ts`:
  - US1-AS8 and FR-025: "Remove" opens a dialog naming the account and its domains and stating that its API keys are revoked permanently, its passkeys and second factors are removed, its sessions end and the domains and mailboxes stay; the confirm control reads "Remove domain administrator"; confirming returns to the list without the account and announces the result; cancelling changes nothing; focus returns to the trigger (FR-068);
  - conventions: a removal refused with `412` (`domain-admin-changed-elsewhere`) reloads and asks for confirmation again;
  - FR-009: a selection mode on phones and checkboxes on desktop (UI 002's `BulkActionBar`); Activate, Deactivate, Suspend two-factor authentication and Remove apply to the selection; Remove lists the selected accounts and requires their number typed; Deactivate asks once with its effect;
  - FR-010: exactly one `applyDomainAdminBulkAction` request with `{ id, version }` per account (asserted with `mockApi.requests()`), a busy state, then a summary with one translated result per account; failed and outdated accounts stay selected, `done` ones are updated in the list; the result is announced (FR-070);
  - conventions: on `capabilities-bulk-limit-2`, after two selections further selection is disabled with a message that states the limit;
  - Edge (multi-select partly fails): a mixed result keeps exactly the failed accounts selected and allows a retry;
  - conventions: a dropped connection (`route.abort()`) reports "outcome unknown" and sends no second request; changing the page, search, filters, sort or size clears the selection.
- [ ] T028 [P] [US1] Write `tests/unit/features/administrators/list-state.spec.ts` for the domain administrator schema of data-model §5: every parameter mapped to the contract's query (`status` → `active`, `tfa` → `secondFactorStatus`, `pending` → the forced flag, repeated `domain` (≤ 100), `permissionValue` sent only with `permission`), defaults omitted from the address, `size` limited to 25, 50 or 100, invalid values normalised with `replace`.
- [ ] T029 [P] [US1] Write `tests/unit/features/administrators/username.spec.ts` (data-model §6): trimming and lower-casing; required; at most `usernameMaxLength` from the capabilities; "only `a-z`, `0-9`, `.`, `_` and `-`, with at least one letter or digit"; `api`, `API` and `Api` refused; `...` and `_-` refused; `reseller.1` accepted.
- [ ] T030 [P] [US1] Write `tests/unit/features/administrators/bulk.spec.ts` for domain administrators (data-model §2 `BulkPlan`): targets carry `id` = username and `version` = etag and never exceed `bulkLimit`; `suspendSecondFactors` leaves out accounts whose status is not `active` and reports them; `needsConfirmation` is `typedCount` for `delete`, `simple` for `deactivate` and `suspendSecondFactors`, none for `activate`.
- [ ] T031 [P] [US1] Write `tests/unit/features/administrators/permissions.spec.ts` and `tests/unit/features/administrators/PermissionsEditor.spec.ts` (research R16):
  - every value of `domainAdminPermissionNameValues` belongs to the group of FR-028 in the stated order, and an unknown plain value lands in "Other";
  - `changedFlags(base, current)` returns only differing flags;
  - the editor renders one `<fieldset>` with a `<legend>` per group, one labelled Reka `Switch` per flag with its explanation referenced by `aria-describedby`, operable by keyboard, and emits the new flag set.
- [ ] T032 [P] [US1] Write `tests/unit/shared/components/DomainPicker-multiple.spec.ts` for the additions research R14 needs in UI 004's shared `DomainPicker.vue` (only the cases its existing tests do not cover): below `md` a full-screen dialog with a search field and checkboxes; "Done" applies, Escape and "Cancel" discard; removable chips with `Domain.unicodeName` and the ASCII name as title; the emitted value is ASCII names; a server error at `domains.<i>` marks that chip with its message; existing single-selection behaviour unchanged.
- [ ] T033 [P] [US1] Write `tests/unit/features/administrators/account-components.spec.ts` for `AccountStatusBadge.vue`, `SecondFactorStatusBadge.vue` (a text for every value of `accountSecondFactorStatusValues`), `DomainAdminCard.vue` (three domains and "+N more", the two warnings, an assignment badge when its status differs), `AccountActionsMenu.vue` (Edit, Activate or Deactivate by status, Suspend only when `active`, Remove, a slot for later entries, disabled items with their visible reason), `UsernameField.vue` (blur normalisation, hint, field errors), `AccountPasswordField.vue` (UI 005's `NewPasswordFields` without `confirm`, the checklist never blocks, the pre-hashed notice) and `SignInRequirementsFields.vue` (two switches with explanations, the product name from branding).
- [ ] T034 [P] [US1] Change UI 001's `tests/unit/app/navigation/visibility.spec.ts` for the catalogue rows of data-model §2: `domainAdmins` (`/administrators/domain-admins`) and `administrators` (`/administrators/admins`), consecutive, administrators only, `domainAdmins` available once US1 registers its routes (T046) and `administrators` a placeholder linking to `/admin/system` until T082 flips it (its test case changes in T074).
- [ ] T035 [P] [US1] Write `tests/unit/features/administrators/confirmations.spec.ts` (the removal content for a domain administrator: account, domains, API keys revoked permanently, passkeys and second factors removed, sessions end, domains and mailboxes stay; for an administrator (FR-038); the confirm labels; the rename texts for another account and for the own account (FR-021); the suspension text (FR-024); the deactivation text (FR-026)) and `tests/unit/features/administrators/secrets.spec.ts` (creation and "Set a new password" run through `useSecretRequest`; afterwards no value of the query cache or the mutation cache contains the password, and no form draft is stored).
- [ ] T036 [P] [US1] Write `tests/smoke/administrators.smoke.spec.ts` against the dev stack: as `admin`, create `smoke-da-<random>` with one seeded domain and a generated password, find it by searching its domain, add a second domain, suspend its second factors, deactivate (confirming) and activate it, and remove it; nothing touches `admin` or `reseller`.

### Implementation for User Story 1

- [ ] T037 [US1] Implement in `src/features/administrators/`:
  - `api.ts`: the domain administrator list and detail queries, `createDomainAdmin` and the password `updateDomainAdmin` (with `If-Match`) through `useSecretRequest`, writing the cache and invalidating the lists afterwards, the section updates through `useVersionedSave`, the delete, suspension and bulk mutations, and `useAccountCapabilities()` (key `['capabilities','accounts']`, 5 min), with the invalidation of data-model §3;
  - `list-state.ts` (domain administrator schema), `username.ts`, `bulk.ts` (`planBulk`), `permissions.ts` and `confirmations.ts`,

  so that T028, T029, T030, T035 and the logic part of T031 pass.
- [ ] T038 [US1] Implement `src/features/administrators/components/AccountPasswordField.vue` on the shared `src/shared/components/password/NewPasswordFields.vue` (without `confirm`; it combines `PasswordField.vue` with "Generate" from `src/shared/password/generate.ts` and `PasswordPolicyHints.vue` over `src/shared/password/policy-rules.ts`) and UI 003's password policy query, with UI 003's pre-hashed notice. When the pre-hashed detection is still `src/features/mailboxes/password/pre-hashed.ts`, promote it with its tests to `src/shared/password/pre-hashed.ts` and update UI 003's imports, without behaviour change (research R22).
- [ ] T039 [P] [US1] Implement `AccountStatusBadge.vue`, `SecondFactorStatusBadge.vue`, `AccountActionsMenu.vue` (Reka `DropdownMenu`), `UsernameField.vue` and `SignInRequirementsFields.vue` in `src/features/administrators/components/`, so that T033 passes with T038.
- [ ] T040 [P] [US1] Extend UI 004's `src/shared/components/DomainPicker.vue` with the multiple-selection presentation of research R14 (full-screen dialog below `md`, checkboxes, chips, per-chip errors) only where it is missing and without changing other callers, so that T032 passes; implement `src/features/administrators/components/DomainAssignmentList.vue` (links to UI 002's `domain-detail`, warnings, assignment badges).
- [ ] T041 [P] [US1] Implement `src/features/administrators/components/PermissionsEditor.vue`, so that T031 passes.
- [ ] T042 [US1] Replace the catalogue row `administrators` with the rows `domainAdmins` and `administrators` of data-model §2 in `src/app/navigation/catalogue.ts` (both placeholders), with the labels `nav.domainAdmins` and `nav.administrators`, so that T034 passes.
- [ ] T043 [US1] Implement the list: `DomainAdminCard.vue`, `DomainAdminTable.vue` and `DomainAdminFilters.vue` (native selects, the domain filter through `DomainPicker`, the permission filter as a flag select plus on/off) in `src/features/administrators/components/`, and `src/features/administrators/pages/DomainAdminsPage.vue` (`useListState`, `ListState`, `PaginationBar`, UI 002's `useBulkSelection` with `bulkLimit` from the capabilities, `BulkActionBar` with the actions and confirmations of `planBulk`, `BulkResultSummary`, page sizes 25/50/100).
- [ ] T044 [US1] Implement `src/features/administrators/pages/DomainAdminCreatePage.vue`: the four sections of FR-011 with the capabilities' defaults, the Permissions section in a collapsed Reka `Collapsible` with the defaults note and its own error state, `useProblemForm` mapping `username`, `password`, `domains.<i>` and `permissions.<name>`, UI 002's `useLeaveGuard`, `createDomainAdmin` through `useSecretRequest` with only the differing flags, then the success message and `router.replace` to the detail.
- [ ] T045 [US1] Implement the detail: `AccountSection.vue` (username, status, dates; edit username with the rename confirmation and status with the deactivation confirmation), `PasswordChangeForm.vue` (the password through `useSecretRequest`), `DomainsSection.vue`, `SignInSecuritySection.vue` (status, passkey count, forced flags, the suspension action with `If-Match`) and `DetailSectionIndex.vue` in `src/features/administrators/components/`, the sections on UI 002's `EditableSection`, and `src/features/administrators/pages/DomainAdminDetailPage.vue` with `NotFoundState`, the removal through `useConfirm` (asked again after `412`), `useLeaveGuard`, and slots for US2, US3, US5 and US7.
- [ ] T046 [US1] Implement `src/features/administrators/routes.ts` (`administrators` at `/administrators`, a redirect to `domain-admins` keeping the query; `domain-admins` at `/administrators/domain-admins`, `domain-admin-create` at `/administrators/domain-admins/-/new` and `domain-admin-detail` at `/administrators/domain-admins/:username` with the param pattern `[A-Za-z0-9._-]{1,255}`, all three with `meta.navEntry: 'domainAdmins'`) and `src/features/administrators/index.ts`; register the routes in `src/app/router/routes.ts`, and set the catalogue row `domainAdmins` to `available` in `src/app/navigation/catalogue.ts`.
- [ ] T047 [US1] Translations for US1:
  - First add this story's legacy keys to `tests/unit/i18n/legacy-keys-007.spec.ts`: `admin.admins` (the navigation label), `admin.domain_admins`, `admin.domain_admin`, `admin.add_domain_admin`, `admin.admin_domains`, `admin.search_domain_da`, `admin.username`, `admin.password`, `admin.active`, `admin.action`, `edit.domain_admin`, `edit.domains`, `edit.force_pw_update`, `edit.force_pw_update_info`, `tfa.tfa`, `tfa.disable_tfa`, `tfa.force_tfa`, `tfa.force_tfa_info`, `mailbox.activate`, `mailbox.deactivate`, `mailbox.remove`, `mailbox.active`, `mailbox.inactive`, `danger.username_invalid`, `danger.object_exists`, `danger.domain_invalid`, `danger.password_complexity`, `success.domain_admin_added`, `success.domain_admin_modified`, `success.domain_admin_removed` and the 19 `acl.*` flag labels. They must fail.
  - Add the `nav.domainAdmins` and `nav.administrators` labels (legacy `admin.domain_admins` and `admin.admins`), and the `accounts.*`, `domainAdmins.*`, `permissions.*` (group names, `permissions.flag.<name>` mapped to the legacy `acl.<column>` labels, `permissions.explanation.<name>`), `validation.format.accountUsername`, `accounts.validation.reservedUsername` (legacy `danger.username_invalid`) and `domainAdmins.validation.domainRequired` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with the mappings in `src/i18n/legacy-map.json`. Supply cs-cz and sk-sk values in the app layer for `tfa.force_tfa`, `tfa.force_tfa_info` and `acl.alias_external_goto`, which upstream lacks. Run `npm run i18n:import`. The legacy-key test and `npm run i18n:check` must pass.

**Checkpoint**: US1 works on its own: all T023–T036 tests pass. This is the MVP.

---

## Phase 4: User Story 2 - Act as a domain administrator or mailbox user, then return (Priority: P1)

**Goal**: "Sign in as" from the domain administrator and mailbox screens, the acting banner on every
screen, the one-tap return to the origin, "Sign out completely", credential controls unavailable
while acting, automatic ends and the behaviour across tabs.

**Independent Test**: Start acting as a mailbox user and as a domain administrator from each entry
point, visit every screen available to the target, and return explicitly and through an
"impersonation ended" refusal; check the banner on every screen at both viewports, that no data of
the previous identity is shown after either switch, and that the user lands on the origin screen.

**Depends on**: US1 (the domain administrator entry points), UI 003 (the mailbox action areas), UI
001 and UI 005 (the credential screens).

### Tests for User Story 2 (write first; must fail)

- [ ] T048 [US2] Implement the impersonation mock, the tab fixture and the scenarios (research R20):
  - `tests/mocks/handlers/impersonation.ts`: `startImpersonation` with the checks of API 007 R16 in order (`pending-action-required`, `409 already-impersonating`, `403 forbidden` for a mailbox user caller or a domain administrator target named by a domain administrator, `403 permission-flag-required` with `requiredFlags: [loginAs]` before any lookup, `422`, `404` for unknown accounts, resources, administrators and mailboxes outside a domain administrator's active assignments), inactive targets allowed, `201` with `Location: /api/v2/session/impersonation` and `ImpersonationStarted` (identity and a new `csrfToken`); `endImpersonation` (`204`, a no-op without an impersonation); `getImpersonation`; register it in `tests/mocks/handlers/index.ts`;
  - `tests/mocks/handlers/identity.ts`: while impersonating, the target's username, role and scope, the effective flags of API 007 R18 (an administrator impersonator: every flag `true`; a domain administrator impersonator: every mailbox user flag `true`, then the impersonator's `da_acl` values for `syncjobs`, `quarantine`, `appPasswds`, `pushover`, `spamPolicy` and the 14 `da_acl`-only flags), the impersonator's `authentication`, `pendingActions` and `preferences`, the `impersonation` member, and `webmailOnBehalfEnabled` for administrator and domain administrator identities;
  - `tests/mocks/handlers/auth.ts`: a helper that renews the anti-forgery token on every start, end and automatic end, so that requests with the old token get `403 csrf-token-mismatch`; `deleteSession` ends the whole session while acting; `getSession` reports `impersonation`;
  - `tests/mocks/handlers/index.ts`: a wrapper that, when `invalidateImpersonation` is set, answers the next session request except `endImpersonation` and `deleteSession` with `403 impersonation-ended`, ends the impersonation and renews the token (`endImpersonation` and `deleteSession` end it and complete normally); and a wrapper that answers `403 not-allowed-while-impersonating` to the passkey operations of `tests/mocks/handlers/passkeys.ts` and to the credential and webmail hand-off operations of UI 005's `tests/mocks/handlers/self-service/own-account.ts` while acting;
  - `tests/e2e/fixtures/tabs.ts`: `openSecondTab(context)` (same context, shared cookie and BroadcastChannel) and `startImpersonationOutOfBand(context, target)`, which calls `POST /api/v2/session/impersonation` through `context.request` with the session cookie and a fresh token, so no broadcast reaches the pages;
  - `tests/mocks/scenarios/acting.ts`, registered in `tests/mocks/scenarios/index.ts`: `acting-admin` (an admin with UI 003's mailboxes, including `alice@example.org`, an inactive mailbox and a mailbox in an inactive domain, and domain administrators, including `reseller`, an inactive one and one without domains), `acting-reseller-login-as` and `acting-reseller-no-login-as` (a domain administrator of two domains with and without `loginAs`), `acting-already` (a session already impersonating `alice@example.org`), `acting-long-names` (a 200-character local part and a 255-character domain administrator username) and `acting-target-forced` (a target with a forced password change).
- [ ] T049 [P] [US2] Write `tests/e2e/acting/acting-mailbox-user.spec.ts`:
  - US2-AS1 and FR-043: on `acting-admin`, "Sign in as" in `MailboxRowActions` opens the mailbox user's home; the banner names `alice@example.org`, "mailbox user", `admin` and the start time; the polite live region announces the switch; no confirmation was asked; SC-002: two taps from the list entry;
  - FR-041: the same from the header of UI 003's mailbox detail screen;
  - US2-AS2, FR-044 and SC-003: on every screen the target can open (home, My account, quarantine, spam filter, passkeys) the banner is at the top, outside any menu, stays visible while scrolling, pushes the content down, and carries an icon and text; on no screen after returning;
  - US2-AS3, FR-046 and SC-005: "Return to admin" (one tap, no confirmation, at least 44 × 44 px) shows the mailbox list again with its search, filters and page restored, and announces the return;
  - FR-045: the banner is a named region; the page title starts with the acting prefix while acting and not afterwards;
  - US2-AS7 and FR-047: the account menu offers "Sign out completely", which ends the session and shows the sign-in screen;
  - US2-AS8 and FR-049: the passkeys page's add, rename and remove controls, and UI 005's password change, second factors and recovery e-mail, are unavailable with "Not available while acting as another user";
  - FR-050: changing the language or theme while acting sends `updatePreferences` and keeps the impersonator's choice after returning;
  - SC-004: after the start no text of the administrator's mailbox list is visible, and after the return no text of the mailbox user's screens is visible;
  - Edge (inactive target): the inactive mailbox and the mailbox in an inactive domain can be acted as;
  - Edge (target's forced actions): on `acting-target-forced` the session is not restricted;
  - Edge (long usernames): on `acting-long-names` at 360 px the local part is shortened with an ellipsis in the middle and the domain stays visible; tapping or focusing the name shows the full text, which is also the accessible name.
- [ ] T050 [P] [US2] Write `tests/e2e/acting/acting-domain-admin.spec.ts`:
  - US2-AS5 (domain administrator half): every entry of the domain administrator list offers "Sign in as", inactive ones included, and the account without domains can be acted as; the detail screen offers it too (FR-041); the administrator-list half is tested in T072;
  - acting as `reseller` shows the domain administrator's navigation and home with its effective flags (FR-048), and the banner names "domain administrator";
  - US2-AS4: on `acting-reseller-login-as`, every mailbox of the reseller's domains offers "Sign in as"; on `acting-reseller-no-login-as`, none does;
  - US2-AS6: while acting, no screen offers "Sign in as";
  - FR-042: on `acting-already` a start answered `already-impersonating`, a start answered `permission-flag-required`, and a `404` each show a translated message and leave the user in their own view.
- [ ] T051 [P] [US2] Write `tests/e2e/acting/acting-ended.spec.ts`:
  - US2-AS9 and FR-051: while acting, `mockApi.patch({ invalidateImpersonation: 'targetDeletedOrRenamed' })`, then a navigation or a save: the message says acting ended because the account is no longer available and the action was not carried out; the banner disappears; the origin screen opens as the administrator; `mockApi.requests()` shows the refused request was not resent (SC-004);
  - Edge (impersonator deactivated): a `401` while acting shows the sign-in screen with UI 001's session-ended message;
  - Edge (screen not available after a switch): ending acting while on a mailbox-user-only screen whose origin is gone opens the administrator's home, not a forbidden state;
  - Edge (removing an account someone is acting as): another administrator's removal of the target leads to the same message on the next request.
- [ ] T052 [P] [US2] Write `tests/e2e/acting/acting-tabs.spec.ts`:
  - FR-054: starting acting in one tab shows the banner and the target's view in the second tab without a reload, and returning removes it there; with the second tab in the background, bringing it to the front shows the current identity without any request on focus;
  - US2-AS10, FR-053 and SC-004: with a form changed in the second tab, `startImpersonationOutOfBand()`, then saving in the second tab: the change is not carried out, the tab explains that the account changed in another tab, then shows the banner and the target's view; `mockApi.requests()` holds the one refused write and no replay;
  - FR-052: the second tab shows no data of the previous identity after either switch.
- [ ] T053 [P] [US2] Write `tests/unit/features/acting/eligibility.spec.ts`, table-driven over data-model §2: roles × target kinds × acting or not × pending actions × `loginAs` × domain in or out of scope; administrators never as targets.
- [ ] T054 [P] [US2] Write `tests/unit/app/shell/ActingBanner.spec.ts` and `tests/unit/app/router/title-acting.spec.ts` (research R7): a `<section>` named by its title; the target, role, impersonator and start time (time only today, date and time otherwise, in the user's locale); the return button's label and size classes; the address split into a shrinking local part and a fixed `@domain`, other usernames truncated at the end; the toggle with `aria-expanded` and the full text as accessible name; no live region inside; the token classes; rendered by both layouts only while acting; the title prefix only while acting.
- [ ] T055 [P] [US2] Write `tests/unit/features/acting/SignInAsAction.spec.ts`, `tests/unit/features/acting/useActingState.spec.ts` and `tests/unit/features/acting/ActingUnavailableNotice.spec.ts`: nothing rendered when `canSignInAs` is false; the origin recorded before the request; `startImpersonation` with `role` and `username`; on `201`, `switchIdentity({ reason: 'actingStarted', identity, csrfToken })`; refusals mapped to their messages; the notice text and its association with the disabled control; a `not-allowed-while-impersonating` problem from a credential form shows the same text (FR-049).
- [ ] T056 [P] [US2] Write `tests/unit/app/shell/UserMenu-acting.spec.ts`: "Sign out completely" while acting, "Sign out" otherwise, both calling UI 001's sign-out.
- [ ] T057 [P] [US2] Write `tests/smoke/acting.smoke.spec.ts`: as `admin`, "Sign in as" `alice@example.org` from the mailbox list, see the banner on two screens, return to the list with its search; "Sign in as" `reseller` from the domain administrator list and return.

### Implementation for User Story 2

- [ ] T058 [US2] Implement `src/features/acting/api.ts` (`startImpersonation`, `endImpersonation`), `src/features/acting/eligibility.ts`, `src/features/acting/composables/useActingState.ts` and `src/features/acting/index.ts`, so that T053 and part of T055 pass.
- [ ] T059 [P] [US2] Implement `src/features/acting/components/SignInAsAction.vue` (a menu item or button variant by prop) and `src/features/acting/components/ActingUnavailableNotice.vue`, so that T055 passes.
- [ ] T060 [P] [US2] Implement `src/app/shell/ActingBanner.vue` with the `ResizeObserver` that sets `--shell-sticky-height`, place it at the top of the sticky region in `src/app/layouts/ShellLayout.vue` and `src/app/layouts/AuthLayout.vue`, and add the acting prefix in `src/app/router/title.ts`, so that T054 passes.
- [ ] T061 [US2] Wire "Return to {impersonator}" in `src/app/shell/ActingBanner.vue` (`endImpersonation`, then `switchIdentity({ reason: 'actingEnded' })`; a network failure keeps acting and shows a retry) and "Sign out completely" in `src/app/shell/UserMenu.vue`, so that T056 passes.
- [ ] T062 [US2] Add the entry points (FR-041): `SignInAsAction` in `src/features/administrators/components/AccountActionsMenu.vue` (domain administrators only) and in the header actions of `src/features/administrators/pages/DomainAdminDetailPage.vue`; and in UI 003's designated action areas `src/features/mailboxes/components/list/MailboxRowActions.vue` and the header of `src/features/mailboxes/pages/MailboxDetailPage.vue`, passing the mailbox's address and domain.
- [ ] T063 [US2] Make the credential controls unavailable while acting (FR-049) with `useActingState()` and `ActingUnavailableNotice`: UI 001's `src/features/passkeys/pages/PasskeysPage.vue`, `src/features/passkeys/components/AddPasskeyForm.vue`, `src/features/passkeys/components/PasskeyCard.vue` and `src/features/passkeys/components/RenamePasskeyDialog.vue`; UI 005's `src/features/account/components/password/OwnPasswordForm.vue`, `src/features/account/components/two-factor/SecondFactorList.vue`, `src/features/account/components/two-factor/AddSecondFactorMenu.vue`, `src/features/account/components/two-factor/TurnOffTwoFactorDialog.vue`, `src/features/account/pages/AddSecondFactorPage.vue` and `src/features/account/components/recovery/RecoveryEmailForm.vue`. Map `not-allowed-while-impersonating` from these screens to the same text.
- [ ] T064 [US2] Translations for US2: first add `success.logged_in_as` to `tests/unit/i18n/legacy-keys-007.spec.ts` (must fail); then add the `acting.*` messages (banner title and line, role names, return, toggle, title prefix, announcements, "Sign in as", unavailable reason), `userMenu.signOutCompletely` and the `loginAs` flag name for `problem.permission-flag-required` to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, and the `success.logged_in_as` mapping to `src/i18n/legacy-map.json`. Run `npm run i18n:import`; the test and `npm run i18n:check` must pass.

**Checkpoint**: US1 and US2 work on their own; acting is complete except webmail (US6).

---

## Phase 5: User Story 3 - Set a domain administrator's permissions (Priority: P2)

**Goal**: The Permissions section of the domain administrator detail screen: grouped switches,
saving only changed flags with the version read, the leave guard and outdated handling.

**Independent Test**: Open a domain administrator, change several flags, save, reload, and check the
request, the success message, the unsaved-changes guard, the outdated handling and the error state.

**Depends on**: US1 (`PermissionsEditor.vue` and the detail screen).

### Tests for User Story 3 (write first; must fail)

- [ ] T065 [US3] Add the scenarios `domain-admin-permissions-fail` (`500` on `updateDomainAdmin` for a `permissions` patch) and `domain-admin-permissions-changed-elsewhere` (the flags change after the read) to `tests/mocks/scenarios/administrators.ts`.
- [ ] T066 [P] [US3] Write `tests/e2e/administrators/permissions.spec.ts`:
  - US3-AS1, FR-027 and FR-028: the Permissions section shows 19 switches with translated labels and explanations in the groups Mailbox settings, Domain settings, Spam and quarantine and Access, reflecting the stored state;
  - US3-AS2 and FR-029: three changed switches send `{ permissions: { … three flags … } }` with `If-Match`, a translated success message appears and is announced, and a reload shows the saved state;
  - US3-AS3: leaving with changed switches asks whether to discard them;
  - US3-AS4 and FR-066: on `domain-admin-permissions-changed-elsewhere` the save explains the account was changed elsewhere, keeps the switches, marks the flags that changed elsewhere and offers the current values;
  - US3-AS5: on `domain-admin-permissions-fail` the switches keep the choices and a translated message offers a retry;
  - Edge (no permission record): every switch reads off; saving creates the record (the request holds only the changed flags);
  - SC-010: from opening the account at 360 px to the saved result in under 30 seconds of test time; the switches work with the keyboard alone.
- [ ] T067 [P] [US3] Write `tests/unit/features/administrators/PermissionsSection.spec.ts`: the diff against the read flags, `If-Match` with the latest etag, the leave guard while dirty, the switches kept and the changed flags marked on `412`, the switches kept on failure, the "load current values" action.
- [ ] T068 [P] [US3] Add to `tests/smoke/administrators.smoke.spec.ts` a case that turns `aliasDomains` on for the smoke domain administrator, reloads and sees it on, then removes the account.

### Implementation for User Story 3

- [ ] T069 [US3] Implement `src/features/administrators/components/PermissionsSection.vue` on UI 002's `EditableSection` and `PermissionsEditor.vue`, and mount it in `src/features/administrators/pages/DomainAdminDetailPage.vue`, so that T066 and T067 pass.
- [ ] T070 [US3] Translations for US3: first add `success.acl_saved` to `tests/unit/i18n/legacy-keys-007.spec.ts` (must fail); then add the `permissions.section.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` and the `success.acl_saved` mapping to `src/i18n/legacy-map.json`. Run `npm run i18n:import`; the test and `npm run i18n:check` must pass.

**Checkpoint**: US1 to US3 work on their own.

---

## Phase 6: User Story 4 - Manage administrator accounts (Priority: P2)

**Goal**: The administrator list, creation and detail screens with the own-account and
last-administrator protections, self-deactivation, self-rename and bulk actions.

**Independent Test**: List, create, edit, rename, deactivate and remove administrators, including
the own account and the last active administrator, and check every protection, confirmation and
message.

**Depends on**: US1 (the shared account components, `AccountPasswordField` and `api.ts`).

### Tests for User Story 4 (write first; must fail)

- [ ] T071 [US4] Implement the administrator handlers and scenarios:
  - `tests/mocks/handlers/admins.ts`: `listAdmins` (`q`, `active`, `secondFactorStatus`, the forced flags, the sorts `username`, `active`, `createdAt`, `modifiedAt`, paging, `meta.total`), `createAdmin` (the username rules and `409` of T023, password policy except for hash-scheme prefixes, `201` with `Location` and `ETag`), `getAdmin`, `updateAdmin` (merge patch, `If-Match`/`412`, `409 last-active-admin` when `active: false` would leave none active, never for changes that keep the count; a self-deactivation answers `200` and ends the session at its next request; a self-rename keeps the session under the new name; renaming another account ends its sessions and impersonations of it), `deleteAdmin` (`If-Match`, `409 cannot-delete-own-account`, `409 last-active-admin`), `suspendAdminSecondFactors` (`If-Match`) and `applyAdminBulkAction` (items in order; the item that would leave none active is `refused` with `last-active-admin`; the own account is `refused` with `cannot-delete-own-account`);
  - `tests/mocks/scenarios/administrators.ts`: `admins-one-active` (the signed-in admin is the only active one, plus an inactive one), `admins-two-active` (one of them with active second factors), `admins-many` (60 administrators), `admins-list-error` (`500` on `listAdmins`), `admin-detail-error` (`500` on `getAdmin`), `admin-changed-elsewhere` and `admins-concurrent-last` (`updateAdmin` answers `last-active-admin` although two are listed as active).
- [ ] T072 [P] [US4] Write `tests/e2e/administrators/admins.spec.ts`:
  - US4-AS1 and FR-032: at 360 px one card per account with username, two-factor status, status and the "You" marker on the own account; a table on desktop; search, the filters status, two-factor status and pending requirement, the sorts without "number of domains", kept in the address; FR-008: "Add administrator" reachable with one tap at 360 px;
  - FR-004: the loading state, the empty state of a filter without matches, and on `admins-list-error` the translated error with a retry; on `admin-detail-error` the detail's error with a retry; an unknown username shows `NotFoundState`;
  - US2-AS5 (administrator half): no entry of the administrator list, and no administrator detail, offers "Sign in as";
  - US4-AS2 and FR-033: create an administrator with a valid username and a password; the success message names it; the form has the Account and Sign-in requirements sections only;
  - US4-AS3 and FR-035: on the own account, "Remove" is disabled in the actions menu and on the detail screen with "You cannot remove the account you are signed in with";
  - US4-AS4 and FR-036: on `admins-one-active`, the own account's deactivation is disabled in the menu and on the edit screen with "At least one administrator must stay active";
  - US4-AS5 and FR-037: on `admins-two-active`, deactivating the own account asks for a confirmation that warns the session ends; confirming saves and then shows the sign-in screen with a translated explanation;
  - FR-026: deactivating the other administrator asks once with its effect; activating it needs no confirmation;
  - US4-AS6 and FR-021: renaming the own account confirms the new username for the next sign-in; afterwards the user menu and the address show the new name, and the session continues; renaming another account confirms that its sessions and any acting session on it end;
  - US4-AS7 and FR-039: on `admins-concurrent-last` the refused deactivation shows its translated message and the account keeps its previous state;
  - FR-038: the removal dialog names the account and states that its API keys are revoked permanently and its passkeys and second factors are removed; the confirm control reads "Remove administrator";
  - FR-031 and FR-034: the detail screen has the Account and Sign-in and security sections, with the forced flags and "Suspend two-factor authentication" (with its confirmation and `If-Match`), and no Permissions or one-time link section;
  - FR-066: on `admin-changed-elsewhere` a save keeps the input and offers the current values with the changes marked.
- [ ] T073 [P] [US4] Write `tests/e2e/administrators/admins-bulk.spec.ts`:
  - FR-035: a bulk Remove and a bulk Deactivate that include the own account send targets without it, and the summary says the own account was left out;
  - per-item `refused` results (`last-active-admin`, `cannot-delete-own-account`) are translated and stay selected; Remove requires the typed number; Deactivate asks once with its effect;
  - FR-036 (stale count) is covered at unit level by T074, because the signed-in administrator is always active and never a target.
- [ ] T074 [P] [US4] Extend `tests/unit/features/administrators/list-state.spec.ts` with the administrator schema, `tests/unit/features/administrators/bulk.spec.ts` with the administrator rules of data-model §2 in their order (`excludedOwn` first, then `blocked: 'lastActiveAdmin'` when the remaining active targets are at least a stale `activeAdminCount`), and `tests/unit/features/administrators/account-components.spec.ts` with `AdminCard.vue` ("You" marker) and the disabled reasons of `AccountActionsMenu.vue` for the own account and for the own account as the last active administrator; and change `tests/unit/app/navigation/visibility.spec.ts` so that the `administrators` row is available (T082).
- [ ] T075 [P] [US4] Write `tests/unit/features/administrators/own-account-flows.spec.ts`: after a self-deactivation `200`, `GET /session` reporting `anonymous` runs UI 001's session end with the notice `selfDeactivated`; after a self-rename `200`, `switchIdentity({ reason: 'selfRenamed' })` targets `admin-detail` with the new name and the old detail key is removed from the cache.
- [ ] T076 [P] [US4] Write `tests/smoke/admins.smoke.spec.ts`: as `admin`, the list shows `admin` with "You" and its Remove disabled; create `smoke-admin-<random>`, deactivate (confirming) and activate it, and remove it; `admin` itself is never changed.

### Implementation for User Story 4

- [ ] T077 [US4] Extend `src/features/administrators/api.ts` with the administrator list and detail queries, `createAdmin` and the password `updateAdmin` through `useSecretRequest`, the section updates, the delete, suspension and bulk mutations and the active-administrator count (key `['admins','active-count']`, `listAdmins({ active: true, limit: 1 })`), `src/features/administrators/list-state.ts` with the administrator schema and `src/features/administrators/bulk.ts` with the administrator rules, so that T074's logic cases pass.
- [ ] T078 [P] [US4] Implement `AdminCard.vue`, `AdminTable.vue` and `AdminFilters.vue` in `src/features/administrators/components/`, and the own-account and last-administrator reasons in `AccountActionsMenu.vue`, so that T074 passes.
- [ ] T079 [US4] Implement `src/features/administrators/pages/AdminsPage.vue` (`useListState`, `ListState`, `PaginationBar`, `useBulkSelection`, `BulkActionBar` and `BulkResultSummary` with the administrator rules).
- [ ] T080 [US4] Implement `src/features/administrators/pages/AdminCreatePage.vue` (Account and Sign-in requirements sections, `UsernameField`, `AccountPasswordField`, `useProblemForm`, `useLeaveGuard`, `createAdmin` through `useSecretRequest`, success message, `router.replace` to the detail).
- [ ] T081 [US4] Implement `src/features/administrators/pages/AdminDetailPage.vue` with `AccountSection` (the own-rename confirmation and `selfRenamed` switch, the last-administrator reason, the deactivation confirmations and the self-deactivation flow of research R15), `PasswordChangeForm`, `SignInSecuritySection`, `DetailSectionIndex`, `NotFoundState`, `useLeaveGuard`, the removal confirmation and the own-account reason, so that T075 passes.
- [ ] T082 [US4] Add the routes `admins` (`/administrators/admins`), `admin-create` (`/administrators/admins/-/new`) and `admin-detail` (`/administrators/admins/:username`), with `meta.navEntry: 'administrators'`, to `src/features/administrators/routes.ts`, and set the catalogue row `administrators` to `available` in `src/app/navigation/catalogue.ts`.
- [ ] T083 [US4] Translations for US4: first add `admin.add_admin`, `edit.admin`, `success.admin_added`, `success.admin_modified` and `success.admin_removed` to `tests/unit/i18n/legacy-keys-007.spec.ts` (must fail); then add the `admins.*` messages (list, form, detail, "You", the reasons "You cannot remove the account you are signed in with" and "At least one administrator must stay active", the self-deactivation and rename confirmations) and `auth.signIn.notice.selfDeactivated` to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with the mappings in `src/i18n/legacy-map.json`. Run `npm run i18n:import`; the test and `npm run i18n:check` must pass.

**Checkpoint**: US1 to US4 work on their own.

---

## Phase 7: User Story 5 - Sign in a domain administrator with a one-time link (Priority: P2)

**Goal**: The one-time sign-in landing (token removed before anything else, no exchange on prefetch,
the question with an existing session, errors and throttling) and the one-time link dialog on the
domain administrator detail screen.

**Independent Test**: Open the landing with a valid, an expired, a used and a malformed token, signed
out and signed in as another account, and create and copy a link as an administrator, for an active
and for an inactive domain administrator.

**Depends on**: US1 for the link dialog (detail screen); the landing depends only on Foundational.

### Tests for User Story 5 (write first; must fail)

- [ ] T084 [US5] Implement `tests/mocks/handlers/sso-tokens.ts` (`issueDomainAdminSsoToken`: a token matching `^[0-9A-F]{6}(-[0-9A-F]{6}){4}$`, `expiresAt` 30 s after issue, `Cache-Control: no-store`, `409 account-inactive`; `createSessionWithSsoToken`: valid only once and within 30 s, case and surrounding whitespace ignored, replacing any session including an impersonating one, `restricted` with `pendingActions` for forced accounts, `401 sign-in-failed` otherwise, `429` with `Retry-After` after the scenario's failure threshold), register it in `tests/mocks/handlers/index.ts`, and add `tests/mocks/scenarios/sso-sign-in.ts` (registered in `tests/mocks/scenarios/index.ts`) with `sso-valid` (anonymous, a fresh token for `reseller`), `sso-valid-signed-in` (an admin session and the same token), `sso-valid-while-acting` (an admin acting as `alice@example.org`; it needs US2's impersonation mock, T048), `sso-expired`, `sso-used`, `sso-forced-password-change` and `sso-throttled`.
- [ ] T085 [P] [US5] Write `tests/e2e/sso-sign-in/landing.spec.ts`:
  - US5-AS1, FR-059 and SC-009: `/ng/sign-in/sso-token?sso_token=<token>` signed out reaches the domain administrator's home within 5 seconds; `page.url()` never shows the token after the first script ran, `page.goBack()` never lands on an address with it, and no API request carries it in a URL or `Referer`;
  - US5-AS2 and FR-061: an expired, a used and a malformed token each lead to the sign-in screen with "This sign-in link is invalid or has expired", without a reason, and normal sign-in works;
  - US5-AS3 and FR-060: on `sso-valid-signed-in` the landing asks, naming the current account and "the domain administrator this link was created for"; "Stay signed in as admin" opens home as admin and sends no `createSessionWithSsoToken`; "Continue" signs in as `reseller`, and a second tab of the old session switches too (FR-052); on `sso-valid-while-acting` the question names `admin` acting as `alice@example.org`;
  - US5-AS4: on `sso-forced-password-change` the restricted session of UI 001 (pending actions) appears;
  - Edge (opened twice): a second opening of the same link shows the invalid-or-expired message;
  - Edge (prefetch): a page opened in a hidden state (init script forcing `document.visibilityState = 'hidden'`) sends no exchange until it becomes visible;
  - Edge (throttled): on `sso-throttled` UI 001's throttling message with its countdown and a link to normal sign-in;
  - the landing without a token opens the sign-in screen.
- [ ] T086 [P] [US5] Write `tests/e2e/sso-sign-in/issue-link.spec.ts`:
  - US5-AS5, FR-062: on an active domain administrator, the One-time sign-in link section's "Create sign-in link" opens the one-time secret dialog with the full link `…/ng/sign-in/sso-token?sso_token=<token>`, a copy control whose result is announced, the countdown from `expiresAt` (`page.clock`), the warning that opening it in this browser replaces the session, and no control that opens the link;
  - FR-063 and Edge (not copied in time): at zero the link is marked expired, copy is disabled, and "Create new link" issues a new one; closing an unexpired link without copying asks for confirmation;
  - FR-063: after leaving the screen and coming back no link is shown, and `localStorage`, `sessionStorage` and `history.state` never held it;
  - US5-AS6: on an inactive domain administrator "Create sign-in link" is disabled with the reason that the account is inactive; a `409 account-inactive` race shows its message.
- [ ] T087 [P] [US5] Write the unit tests:
  - `tests/unit/features/auth/sso-token-capture.spec.ts`: on the landing path, the token is read, `history.replaceState` removes it (keeping other parameters) before `bootstrap()` is called, and it is held in memory until consumed or discarded; other paths are untouched; `handOverSsoToken(token)` puts a token into the same holder for UI 014's arrival page;
  - `tests/unit/features/auth/useSsoTokenSignIn.spec.ts`: the landing state machine of data-model §7, waiting for `visibilitychange` and `prerenderingchange`, every outcome (`201` active and restricted, `401`, `422`, `429`, network), the names in the question (current account; impersonator and acted-as account while acting), the exchange through `useSecretRequest`, and no token in the query or mutation cache at any point;
  - `tests/unit/app/router/guards.spec.ts` (UI 001, extended by UI 005 for `meta.public`): a case that `sign-in-sso-token` resolves in the `anonymous`, `pendingSecondFactor`, `restricted` and `active` states;
  - `tests/unit/features/administrators/SsoLinkSection.spec.ts` and `tests/unit/features/administrators/sso-link.spec.ts`: the link built from `location.origin`, the router base and the token; the token requested through `useSecretRequest`, with the query and mutation caches empty afterwards; disabled with its reason for an inactive account;
  - `tests/unit/shared/components/OneTimeSecretDialog-expiry.spec.ts`: with `expiresAt` and `serverDate`, the countdown uses the clock skew, is announced at the start and at 10 seconds, ends in the expired state with copy disabled and the "Create new link" slot, and closing an expired link needs no confirmation; without `expiresAt` the dialog behaves as before.
- [ ] T088 [P] [US5] Write `tests/smoke/sso-sign-in.smoke.spec.ts`: as `admin`, create a sign-in link for `reseller` and copy it; open it in a new browser context within its validity and land on the reseller's home; opening it again shows the invalid-or-expired message.

### Implementation for User Story 5

- [ ] T089 [US5] Implement `src/features/auth/sso-token-capture.ts` (exported from `src/features/auth/index.ts`) and call it in `src/main.ts` before the bootstrap; export `handOverSsoToken()` from `src/features/auth/index.ts` for UI 014's arrival page; add `createSessionWithSsoToken` through `useSecretRequest` to `src/features/auth/api.ts`; implement `src/features/auth/composables/useSsoTokenSignIn.ts` with the state machine of data-model §7, using `switchIdentity({ reason: 'sessionReplaced' })` when a session existed and UI 001's after-sign-in path otherwise.
- [ ] T090 [US5] Implement `src/features/auth/pages/SsoTokenLandingPage.vue` (the question, the busy state, UI 001's `useThrottle` message, the error with "Try again"), add the route `sign-in-sso-token` (`/sign-in/sso-token`, the canonical `meta.public: true`, which UI 005's guard rule already resolves in every session state) to `src/features/auth/routes.ts`, and add the notice `ssoLinkInvalid` to `src/features/auth/components/SignInNotice.vue`, so that T087's landing and guard cases pass.
- [ ] T091 [P] [US5] Extend `src/shared/components/OneTimeSecretDialog.vue` with the optional props `expiresAt` and `serverDate` (countdown through `useCountdown`, expired state, `create-new` slot) without changing its behaviour for other callers, so that T087's dialog case passes.
- [ ] T092 [US5] Implement `src/features/administrators/sso-link.ts`, `issueDomainAdminSsoToken` through `useSecretRequest` in `src/features/administrators/api.ts`, and `src/features/administrators/components/SsoLinkSection.vue`, and mount the section in `src/features/administrators/pages/DomainAdminDetailPage.vue`.
- [ ] T093 [US5] Translations for US5: add the `ssoSignIn.*` (title, question, continue, stay, busy, error), `ssoLink.*` (section, action, inactive reason, warning, expired, create new, countdown announcements) and `auth.signIn.notice.ssoLinkInvalid` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. `npm run i18n:check` must pass.

**Checkpoint**: US1 to US5 work on their own.

---

## Phase 8: User Story 6 - Open a mailbox's webmail on the user's behalf (Priority: P3)

**Goal**: "Open webmail as" next to "Sign in as" on mailbox entries when the operator allows it, a
new tab without leaving the app, refusals as messages, and webmail unavailable while acting.

**Independent Test**: With the setting reported on and off, check where "Open webmail as" appears for
an administrator and for domain administrators with and without the flag, check that webmail is
unavailable while acting, and check the refusal messages.

**Depends on**: US2 (the acting state and the mailbox entry points of T062), UI 003 (mailbox
capabilities) and UI 005 (`WebmailAction.vue`).

### Tests for User Story 6 (write first; must fail)

- [ ] T094 [US6] Add `createWebmailSignInOnBehalf` to `tests/mocks/handlers/impersonation.ts` with the checks of API 007 R21 in order (`not-allowed-while-impersonating`, `pending-action-required`, `forbidden` for mailbox users, `permission-flag-required` with `requiredFlags: [loginAs]`, `webmail-on-behalf-disabled` when `allowAdminEmailLogin` is off, `groupware-disabled` when `groupwareEnabled` is off, `404`, `422 notEligible` on `mailbox` with `reason` `mailboxInactive`, `loginDisabled` or `domainInactive`) and `200` with the required `Set-Cookie` and `Cache-Control: no-store` headers and `url: /SOGo/so/`; add the scenarios `webmail-on`, `webmail-off`, `webmail-groupware-disabled` and `webmail-reseller` (with and without `loginAs`) to `tests/mocks/scenarios/acting.ts`; and write `tests/e2e/fixtures/popup.ts` (fulfils `/SOGo/**` with a stub page, records popups, and an option whose init script makes `window.open` return `null`).
- [ ] T095 [P] [US6] Write `tests/e2e/webmail-on-behalf/webmail.spec.ts`:
  - US6-AS1 and FR-056: on `webmail-on`, "Open webmail as" on an active mailbox opens a new tab at the webmail address while the app stays on the list; the same from the mailbox detail header;
  - US6-AS2 and FR-055: on `webmail-off` no "Open webmail as" appears in the list or the detail; on `webmail-groupware-disabled` neither;
  - US6-AS3: an inactive mailbox and a mailbox whose login is disabled each show their translated refusal and open no tab;
  - FR-055: on `webmail-reseller` the action appears only with `loginAs`, and only for mailboxes of the reseller's domains;
  - US6-AS4 and FR-057: while acting as a mailbox user, UI 005's Webmail action on the user's home is shown unavailable with "Not available while acting as another user", and no "Open webmail as" is offered anywhere;
  - Edge (browser blocks the tab): with the blocking option, a link "Open webmail" appears and opens the tab when tapped.
- [ ] T096 [P] [US6] Write `tests/unit/features/acting/webmail-opener.spec.ts` and `tests/unit/features/acting/OpenWebmailAsAction.spec.ts`: the request (an ordinary mutation) comes before `window.open`; `opener` is cleared on the returned window; a `null` window shows the link with `rel="noopener noreferrer"`; every refusal of research R9 maps to its message and calls no `window.open`; nothing rendered when `canOpenWebmailAs` is false (including `groupwareEnabled: false`).
- [ ] T097 [P] [US6] Add a case tagged `@webmail` to `tests/smoke/acting.smoke.spec.ts`: with `SMOKE_WEBMAIL_ON_BEHALF=1`, as `admin`, "Open webmail as" `alice@example.org` opens the webmail in a new tab showing her mailbox; skipped otherwise.

### Implementation for User Story 6

- [ ] T098 [US6] Implement `src/features/acting/webmail-opener.ts`, the `createWebmailSignInOnBehalf` mutation in `src/features/acting/api.ts`, and `src/features/acting/components/OpenWebmailAsAction.vue`, exported from `src/features/acting/index.ts`, so that T096 passes.
- [ ] T099 [US6] Add `OpenWebmailAsAction` next to `SignInAsAction` in `src/features/mailboxes/components/list/MailboxRowActions.vue` and the header of `src/features/mailboxes/pages/MailboxDetailPage.vue`, passing `groupwareEnabled` from UI 003's `useMailboxCapabilities()`; change UI 005's `src/features/account/components/overview/WebmailAction.vue` to show the action disabled with `ActingUnavailableNotice` while acting instead of hiding it (FR-057).
- [ ] T100 [US6] Translations for US6: first add `user.open_webmail_sso` to `tests/unit/i18n/legacy-keys-007.spec.ts` (must fail); then add the `webmailOnBehalf.*` messages (action, blocked-tab link, the three `notEligible` reasons) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` and the `user.open_webmail_sso` mapping to `src/i18n/legacy-map.json`. Run `npm run i18n:import`; the test and `npm run i18n:check` must pass.

**Checkpoint**: US1 to US6 work on their own.

---

## Phase 9: User Story 7 - Trace account changes and impersonations (Priority: P3)

**Goal**: "View history" on both detail screens, and the impersonated account in audit records and
as an audit log filter.

**Independent Test**: Follow "View history" from an administrator and a domain administrator, filter
by impersonated account, and check that records written while acting show both accounts.

**Depends on**: US1 and US4 (the detail screens); the audit log part depends only on Foundational.

### Tests for User Story 7 (write first; must fail)

- [ ] T101 [US7] Extend `tests/mocks/handlers/audit.ts` with `impersonatedAccount` in records and as a filter (exact match after lower-casing, including impersonation starts and ends), and add the scenario `audit-impersonation` (records of the 12 event types of API 007, records written while `admin` acted as `bob@a.example` and as `reseller`, and `ssoToken` sign-ins) to `tests/mocks/scenarios/acting.ts`.
- [ ] T102 [P] [US7] Write `tests/e2e/audit-log/impersonation.spec.ts`:
  - US7-AS1 and FR-071: "View history" on an administrator's and on a domain administrator's detail opens the audit log with `targetType` and `targetId` in the address and the request;
  - US7-AS2: records written while acting show the impersonator as the actor and the impersonated account, marked as done while acting, in text;
  - US7-AS3: the impersonated-account filter `bob@a.example` leaves only those records, appears as a removable chip, is kept in the address and survives a reload;
  - every event type of API 007 and the `ssoToken` method have translated labels; passwords appear only as "changed".
- [ ] T103 [P] [US7] Write `tests/unit/features/audit-log/impersonation.spec.ts`: `impersonated` mapped to `impersonatedAccount` (≤ 255 characters), the chip, `AuditEventItem.vue` rendering the actor and "while acting as {username} ({role})", and labels for the 12 event types, the targets `admin`, `domainAdmin`, `ssoToken` and `impersonation`, and `ssoToken`.
- [ ] T104 [P] [US7] Add a case to `tests/smoke/acting.smoke.spec.ts`: after acting as `alice@example.org`, the audit log filtered by impersonated account `alice@example.org` lists the run's impersonation start and end.

### Implementation for User Story 7

- [ ] T105 [US7] Extend UI 001's audit log: `impersonated` in `src/features/audit-log/list-state.ts`, the filter field in `src/features/audit-log/components/AuditFilters.vue`, the chip through the shared `src/shared/components/ActiveFilterChips.vue`, the marker in `src/features/audit-log/components/AuditEventItem.vue`, and the labels in `src/features/audit-log/labels.ts`, so that T103 passes.
- [ ] T106 [US7] Add UI 002's `HistoryLink` (`targetType` `admin` or `domainAdmin`, `targetId` the username) to `src/features/administrators/pages/AdminDetailPage.vue` and `src/features/administrators/pages/DomainAdminDetailPage.vue`.
- [ ] T107 [US7] Translations for US7: add `auditLog.filters.impersonated`, `auditLog.impersonation.marker` and the History link label to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` (the event, target and method labels came with T005). `npm run i18n:check` must pass.

**Checkpoint**: All user stories work on their own.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story verification, budgets, translations, parity notes and validation.

- [ ] T108 [P] Write and pass `tests/e2e/administrators/reflow-and-keyboard.spec.ts`: every screen and dialog of this feature (both lists, both forms, both detail screens, the picker, the confirmations, the bulk summary, the one-time link dialog, the landing, the banner) has no horizontal scroll at 320 px and at the equivalent of 400 % zoom, never hides the focused element behind the sticky banner and header (WCAG 2.4.11), and runs no transition under `prefers-reduced-motion: reduce`; and the main path of each of US1 to US7 completes with the keyboard alone with visible focus (SC-006).
- [ ] T109 [P] Extend UI 001's `tests/e2e/shell/storage-and-secrets.spec.ts` with the flows of this feature (creating an account with a generated password, changing a password, acting and returning, the landing, the one-time link): `localStorage` and `sessionStorage` hold only the keys of UI 001 data-model §4; no value, URL in history or `history.state` contains a password, a sign-in token, a one-time link or an acting origin path.
- [ ] T110 Run `npm run build && npm run budget:check && npm run lhci` (`scripts/check-bundle-budget.mjs`, `lighthouserc.cjs`). The initial JavaScript stays at most 204,800 bytes gzipped (the entry chunk grows only by the banner, the shell notice and the session modules), and Lighthouse performance and accessibility stay at least 0.9.
- [ ] T111 [P] Run `npm run i18n:check` and `npm run lint` (UI 001's `vue/no-v-html` rule keeps every username, domain name and audit value plain text, FR-075); remove the unused keys reported from `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`; confirm that `tests/unit/i18n/legacy-keys-007.spec.ts` lists all 59 legacy keys of the spec (SC-007); and list the new cs-cz and sk-sk strings for the owner's review (UI 001 plan, owner question 4).
- [ ] T112 [P] Add the plan's two parity notes to the "Legacy Parity" table in `specs/007-administrators-domain-admins/spec.md`: bulk progress is a busy state because results arrive in one response; after a reload while acting, "Return" opens the own home screen.
- [ ] T113 [P] Hand two findings of `specs/007-administrators-domain-admins/plan.md` ("API dependency and gaps") to the owner for mailcow-rest-v2: gap G1 (a non-consuming token read answering the username or the generic `sign-in-failed`, counted towards the sign-in throttle), and finding 7 (`notEligible` described with `expected: primaryDomain` in `DomainAdminCreateRequest` but `kind: aliasDomain` in `ValidationRuleCode`). When a later contract offers G1, a follow-up bump adds the link's account to the question in `src/features/auth/pages/SsoTokenLandingPage.vue` (FR-060).
- [ ] T114 Run `quickstart.md` Part B on a mid-range Android phone and an iPhone with the production build served by `npm run preview:mock` on the local network. Record the SC-001, SC-002, SC-009 and SC-010 timings and a VoiceOver and TalkBack pass of US1, US2 and US5 (SC-006) in a "Validation log" section appended to `specs/007-administrators-domain-admins/quickstart.md`.
- [ ] T115 Run `quickstart.md` Part C (`scripts/smoke/stack-up.sh`, `npm run test:smoke`, `scripts/smoke/stack-down.sh`) once API 007 runs in the mailcow-rest-v2 dev stack, including the `@webmail` case when the stack enables `ALLOW_ADMIN_EMAIL_LOGIN`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** depends on UI 001 to 006 being implemented. T002 needs T001; T004 needs T003;
  T005 needs T001.
- **Foundational (Phase 2)** depends on Setup and **blocks every user story**. Within it: T007,
  T008 and the tests T009–T014 in parallel; then T015 → T016 → (T017, T018, T019 in any order);
  T020 at any time; T021 after T015; T022 last.
- **User stories (Phases 3–9)** depend on Foundational and on each other as the table shows.
- **Polish (Phase 10)** depends on every story it verifies.

### User Story Dependencies

| Story | Priority | Depends on | Why |
|---|---|---|---|
| US1 | P1 | Foundational; UI 002 (bulk, sections, leave guard, typed confirmation, domain route), UI 003 (`NotFoundState`, policy query, pre-hashed detection), UI 004 (`DomainPicker`), UI 005 (password fields) | MVP: creates the feature, its shared components and the domain administrator screens |
| US2 | P1 | US1 (T039, T045); UI 003 (`MailboxRowActions.vue`, `MailboxDetailPage.vue`); UI 001 and UI 005 (credential screens) | The entry points live in US1's actions menu and detail page and in UI 003's action areas |
| US3 | P2 | US1 (T041, T045) | Mounts `PermissionsSection` on the editor and the detail page |
| US4 | P2 | US1 (T037, T038, T039, T045) | Reuses the account components, the password field and the sections; T081's self-rename uses the Foundational switch; T072 also asserts US2-AS5's administrator half |
| US5 | P2 | Foundational for the landing, except the `sso-valid-while-acting` case, which needs US2's impersonation mock (T048); US1 (T045) for the link dialog; UI 005 (`OneTimeSecretDialog`, `useSecretRequest`, `meta.public`) | The landing is otherwise independent; the link lives on the detail page |
| US6 | P3 | US2 (T058, T062); UI 003 (mailbox capabilities); UI 005 (`WebmailAction.vue`) | The action sits next to "Sign in as" and needs the acting state |
| US7 | P3 | Foundational for the audit log; US1 and US4 (T045, T081) for History links; UI 002 (`HistoryLink`), UI 003 (`ActiveFilterChips`) | Links on both detail pages |

### Files edited by several stories

Edits to these files must be serialised, even when stories run in parallel:

- `src/features/administrators/pages/DomainAdminDetailPage.vue`: US1, US2, US3, US5, US7;
- `src/features/administrators/pages/AdminDetailPage.vue`: US4, US7;
- `src/features/administrators/api.ts`, `list-state.ts`, `bulk.ts` and `routes.ts`: US1, US4, US5;
- `src/features/administrators/components/AccountActionsMenu.vue`: US1, US2, US4;
- `src/app/navigation/catalogue.ts` and `tests/unit/app/navigation/visibility.spec.ts`: US1, US4;
- `src/features/mailboxes/components/list/MailboxRowActions.vue` and `src/features/mailboxes/pages/MailboxDetailPage.vue`: US2, US6;
- `src/features/acting/api.ts` and `src/features/acting/index.ts`: US2, US6;
- `src/features/account/` screens: US2, US6;
- `src/app/layouts/ShellLayout.vue` and `AuthLayout.vue`: Foundational, US2;
- `tests/mocks/handlers/{index,admins,impersonation}.ts`: US1, US2, US4, US5, US6;
- `tests/mocks/scenarios/{administrators,acting}.ts`: US1, US2, US3, US4, US6, US7;
- `tests/smoke/{administrators,acting}.smoke.spec.ts`: US1, US2, US3, US6, US7;
- `tests/unit/features/administrators/{list-state,bulk,account-components}.spec.ts`: US1, US4;
- `tests/unit/i18n/legacy-keys-007.spec.ts`, `src/i18n/messages/*.json` and `src/i18n/legacy-map.json`: Setup and every story.

### Within Each User Story

- First the mock handlers, scenarios and fixtures; then end-to-end, unit and smoke tests, which must
  fail; then the implementation (logic → components → pages → routes); then the messages in all
  three locales, each story's legacy keys added to the legacy-key test first.

### Parallel Opportunities

- Setup: T003, T005 and T006 in parallel with T002.
- Foundational: T007–T014 and T020 in parallel; T017, T018 and T019 in parallel after T016.
- US1: T024–T036 in parallel after T023; T039, T040 and T041 in parallel after T037 and T038.
- After US1: US3, US4 and US5 can be staffed in parallel with US2, observing the shared files above;
  US6 follows US2; US7 follows US4.

---

## Parallel Example: User Story 1

```bash
# After T023 (handlers and scenarios), write all US1 tests together:
Task: "T024 tests/e2e/administrators/domain-admins-list.spec.ts"
Task: "T025 tests/e2e/administrators/domain-admin-create.spec.ts"
Task: "T026 tests/e2e/administrators/domain-admin-detail.spec.ts"
Task: "T027 tests/e2e/administrators/domain-admin-remove-and-bulk.spec.ts"
Task: "T028–T035 unit tests"     Task: "T036 tests/smoke/administrators.smoke.spec.ts"

# After T037 (logic) and T038 (password field), build the components together:
Task: "T039 account components"
Task: "T040 DomainPicker extension + DomainAssignmentList"
Task: "T041 PermissionsEditor.vue"
# T042–T046 then build the catalogue rows, pages and routes in order.
```

## Parallel Example: User Story 2

```bash
# After T048 (impersonation mock, tab fixture, scenarios):
Task: "T049 tests/e2e/acting/acting-mailbox-user.spec.ts"
Task: "T050 tests/e2e/acting/acting-domain-admin.spec.ts"
Task: "T051 tests/e2e/acting/acting-ended.spec.ts"
Task: "T052 tests/e2e/acting/acting-tabs.spec.ts"
Task: "T053–T056 unit tests"     Task: "T057 tests/smoke/acting.smoke.spec.ts"
# After T058:
Task: "T059 SignInAsAction.vue + ActingUnavailableNotice.vue"
Task: "T060 ActingBanner.vue + layouts + title prefix"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup), then Phase 2 (Foundational).
2. Phase 3 (US1): domain administrators can be listed, created, edited and removed.
3. **Stop and validate**: `npm run test:e2e -- tests/e2e/administrators` on both viewports and the
   US1 rows of quickstart Part B.

### Incremental Delivery

1. Foundation, then US1 (MVP): the daily delegation task leaves the classic interface.
2. US2 (acting): the daily support tool.
3. US3 (permissions) and US4 (administrators): the remaining account screens.
4. US5 (one-time links): billing panels can redirect to the app.
5. US6 (webmail on behalf) and US7 (history and impersonation audit).
6. Polish: reflow and keyboard, storage audit, budgets, translations, parity notes, findings for the
   API, device validation and the smoke run.

### Parallel Team Strategy

After Foundational:
- Developer A: US1, then US3.
- Developer B: US2 (after US1's T039 and T045), then US6.
- Developer C: US5's landing (T084–T091; its while-acting case after US2's T048), then US4, then US7.

Edits to the shared files listed under "Files edited by several stories" run one at a time.

---

## Notes

- [P] tasks touch different files and have no dependency on an incomplete task.
- [USn] labels map tasks to the spec's user stories, and test titles carry the spec IDs for
  traceability.
- Verify that each test fails before implementing (constitution VI).
- Commit after each task or logical group, directly to `main`, with short imperative subjects.
- Never add a hand-written API type, a `v-html` outside `SanitizedHtml.vue`, an inline style or
  script, a storage key outside UI 001 data-model §4, a password, token or link in a TanStack cache,
  a renamed copy of a canonical shared block, polling, or a request resent under another identity.
