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

**Prerequisites**: UI 001 to UI 006 are implemented (their shared blocks are listed in research
R22), and the contract pin contains API 007 (T001). API 007's implementation is needed only for the
smoke tests (T110).

**Tests**: Mandatory (constitution VI, test-first). In every phase, tests are written first and must
fail before the implementation tasks that follow them. Every end-to-end spec:
- runs on the `mobile-chromium` (360 px), `desktop-chromium` and `mobile-webkit` projects;
- calls `expectAccessible` (axe, WCAG 2.2 AA, both themes) on every screen, dialog and state it
  reaches, and `expectNoHorizontalScroll` and `expectTouchTargets` on the mobile projects;
- fails on any CSP violation or mock contract violation (UI 001 fixtures);
- names its spec reference in the test title (`US2-AS3 …`, `FR-052 …`, `SC-004 …`, `Edge: …`).

**Organization**: Tasks are grouped by user story (spec priorities P1 to P3), so that each story can
be implemented and tested on its own once the foundation is in place.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1 to US7)
- Paths are relative to the repository root `mailcowui-ng/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Pin a contract that contains API 007, expose its types, and extend the translation
check (research R1, R17).

- [ ] T001 Check the contract pin (research R1, [contracts/README.md](./contracts/README.md)):
  - Read `contract/VERSION.json`. If its `commit` contains mailcow-rest-v2 commit `a13c370` (API 007's final contract) and the contracts of API 004 (`df21611`) and API 005 (`f8d973a`), keep it.
  - Otherwise run `scripts/contract/bump.sh 32079252d55797d3da4e58ae661e9fb91c51c6f9`, which rewrites `contract/openapi.yaml`, `contract/openapi.json`, `contract/VERSION.json` and `src/api/generated/schema.ts`. Confirm the bundle sha256 `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6` and the 21 operations of API 007. Never pin "the latest commit".
  - Confirm that `schema.ts` exports `domainAdminPermissionNameValues`, `accountSecondFactorStatusValues` and `knownProblemTypeValues`.
  - Run `npm run typecheck && npm run test:unit && npm run test:e2e`, and fix what the bump breaks in earlier features, as a deliberate bump requires (constitution I). For new `AuditEventType`, `AuditTarget.type` and `AuthMethod` values of API features after 007 that `i18n:check` now demands, add their messages with UI 001's generic fallback text (`auditLog.unknown` wording) in `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`; their own UI features replace them later.
- [ ] T002 Re-export the new generated root types and enumeration arrays from `src/api/index.ts`: `Admin`, `AdminCreateRequest`, `AdminPatch`, `DomainAdmin`, `DomainAdminAssignment`, `DomainAdminCreateRequest`, `DomainAdminPatch`, `DomainAdminPermissions`, `DomainAdminPermissionsPatch`, `DomainAdminPermissionName`, `AccountSecondFactorStatus`, `AccountCapabilities`, `AccountBulkActionRequest`, `BulkTarget`, `BulkResult`, `BulkItemResult`, `DomainAdminSsoToken`, `SsoTokenSignInRequest`, `Impersonation`, `ImpersonationStartRequest`, `ImpersonationStarted`, `MailboxWebmailSignIn`, `AuditImpersonatedAccount`, and `domainAdminPermissionNameValues`, `accountSecondFactorStatusValues`, `knownProblemTypeValues`. No hand-written API type (constitution I). `npm run typecheck` must pass.
- [ ] T003 [P] Extend `tests/unit/scripts/i18n-tools.spec.ts` (UI 001 T020) with cases for the two new covered enumerations: a missing `permissions.flag.<name>` key for a `DomainAdminPermissionName` value, or a missing `accounts.secondFactorStatus.<value>` key for an `AccountSecondFactorStatus` value, fails the check. The new cases must fail.
- [ ] T004 Add `DomainAdminPermissionName` (keys `permissions.flag.<name>`) and `AccountSecondFactorStatus` (keys `accounts.secondFactorStatus.<value>`) to the covered enumerations of `scripts/i18n/check.mjs`, reading the arrays from `src/api/generated/schema.ts`, so that T003 passes.
- [ ] T005 [P] Add the acting colour tokens `--color-acting-bg`, `--color-acting-fg` and `--color-acting-border` for both themes to `src/styles/main.css` (an amber treatment distinct from the header, AA contrast in light and dark, research R7). Add the inline-SVG icons `UserSwitchIcon.vue`, `ShieldOffIcon.vue` and `LinkIcon.vue` to `src/shared/icons/` and its barrel `src/shared/icons/index.ts` (TailAdmin first, otherwise Lucide, recorded in `THIRD_PARTY_NOTICES.md`).

**Checkpoint**: The pinned contract contains API 007, its types are importable from `@/api`, and
`npm run i18n:check` covers the two new enumerations.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The mock state for accounts and impersonation, and the identity-switch core that acting
(US2), the self-rename (US4) and the one-time link (US5) need: the switch protocol, the changed
anti-forgery retry, the `impersonation-ended` reaction, the cross-tab change and the shell notice
(research R4, R5, R19).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Test infrastructure

- [ ] T006 [P] Extend the mock scenario model and add factories (research R20):
  - `tests/mocks/scenarios/state.ts`: `admins` and `domainAdmins` (username, active, forced flags, created and modified times, second factors as `none`/`active`/`suspended` entries, active passkey count, a version counter for the `etag`), domain administrator `assignments` (domain, active, created, `domainExists`) and `permissions` (the 19 flags, or `null` for a missing record), `accountDefaults` (the 19 defaults of API 007 FR-037, `bulkLimit` 100, page sizes 25 and 1000, `usernameMaxLength` 255, `ssoTokenLifetime` 30), `ssoTokens` (token, username, issued at, used), `session.impersonation` (id, impersonator with role and auth method, target with role, started at), the settings `allowAdminEmailLogin` and `groupwareEnabled`, and the flag `invalidateImpersonation`;
  - `tests/mocks/factories/admin.ts`, `tests/mocks/factories/domain-admin.ts` (representations built from the state, with `etag` = an HMAC-like hash of username, status, forced flags, assignments and permissions) and `tests/mocks/factories/impersonation.ts` (an `Impersonation` with a ULID `id`).

### Tests for the core (write first; must fail)

- [ ] T007 [P] Write `tests/unit/app/session/identity-key.spec.ts` and `tests/unit/app/session/acting-origin.spec.ts` (data-model §2):
  - the key is `username|role|impersonation.id` and differs when only the impersonation ID changes;
  - the origin keeps the route's `fullPath` (path and query), is cleared on every switch except a start, and is never written to `localStorage`, `sessionStorage` or `history.state`.
- [ ] T008 [P] Write `tests/unit/app/session/identity-switch.spec.ts` (research R4). It must check, for each reason of the R4 table:
  - `identityTransition` becomes `true` and the layout's `<RouterView>` content is unmounted **before** `queryClient.cancelQueries()`, the mutation cache clear and `queryClient.clear()` run;
  - the anti-forgery token comes from the response when given (start), otherwise from one single-flight `GET /csrf-token`;
  - the identity comes from the response when given, otherwise from `GET /me`; then `GET /session` runs;
  - `session-changed` is broadcast except for `changedInAnotherTab`;
  - the target: the acting origin for `actingEnded` and `actingEndedByServer`, the current route for `changedInAnotherTab`, the new name for `selfRenamed`, and `home` whenever `canAccess` denies the target;
  - the announcement or shell notice of each reason, with `refusedWrite` adding "your last action was not carried out";
  - a network failure of steps 3 or 4 shows the retry state and never re-mounts the previous page; a `401` runs UI 001's session end.
- [ ] T009 [P] Change `tests/unit/api/client.spec.ts` (UI 001 T030) for research R5: after `403 csrf-token-mismatch`, the client fetches a token and calls `GET /me`; with an equal identity key it replays the original request once (the existing FR-035 case); with a different key it does **not** replay, calls `switchIdentity({ reason: 'changedInAnotherTab', refusedWrite: true })` and rejects with an `ApiProblem` of `kind: 'identityChanged'`; a `401` from `GET /me` ends the session; a second mismatch after a replay ends the session. The new cases must fail.
- [ ] T010 [P] Change `tests/unit/api/query-client.spec.ts` (UI 001 T030): a query or mutation error of type `/api/v2/problems/impersonation-ended` calls `switchIdentity({ reason: 'actingEndedByServer' })` once and is never retried.
- [ ] T011 [P] Write `tests/unit/app/session/cross-tab-identity.spec.ts`: a received `session-changed` runs `switchIdentity({ reason: 'changedInAnotherTab' })`, which refreshes the anti-forgery token; an identity refresh whose key differs from the cached one does the same; an equal key does nothing (FR-052, FR-054).
- [ ] T012 [P] Write `tests/unit/app/shell/ShellNotice.spec.ts` and `tests/unit/app/layouts/identity-transition.spec.ts`:
  - `ShellLayout.vue` and `AuthLayout.vue` render the "Switching account…" status (`role="status"`) instead of `<RouterView>` while `identityTransition` is `true`;
  - `ShellNotice.vue` shows `shellNotice` at the top of the main content, is announced in the assertive region, can be dismissed with a labelled 44 × 44 px button, and is cleared by the next navigation.

### Core implementation

- [ ] T013 Implement `src/app/session/identity-key.ts`, `src/app/session/acting-origin.ts`, the session store fields `identityTransition`, `actingOrigin` and `shellNotice` and the notices `ssoLinkInvalid` and `selfDeactivated` in `src/app/session/store.ts` (data-model §4), and the `ApiProblem` kind `'identityChanged'` in `src/api/problem.ts`, so that T007 passes.
- [ ] T014 Implement `src/app/session/identity-switch.ts` with the seven steps of research R4, so that T008 passes. Replace UI 001's username-and-role comparison in `src/app/session/cross-tab.ts` with `identityKey`.
- [ ] T015 Implement the identity check before a replay in `src/api/csrf.ts` (research R5), so that T009 passes.
- [ ] T016 Add the `impersonation-ended` reaction to the `QueryCache` and `MutationCache` `onError` hooks in `src/api/query/client.ts`, and the key roots `admins`, `domain-admins`, `capabilities.accounts` and `domains.picker` of data-model §3 to `src/api/query/keys.ts`, with the list parameter types aliased from the generated `operations['listAdmins' | 'listDomainAdmins']['parameters']['query']`, so that T010 passes.
- [ ] T017 Make `src/app/session/cross-tab.ts` run `switchIdentity({ reason: 'changedInAnotherTab' })` for a received `session-changed`, so that T011 passes.
- [ ] T018 Implement `src/app/shell/ShellNotice.vue` and the transition gate and notice placement in `src/app/layouts/ShellLayout.vue` and `src/app/layouts/AuthLayout.vue`, so that T012 passes.
- [ ] T019 Add the messages `session.switching`, `acting.notice.endedByServer`, `acting.notice.changedInAnotherTab`, `acting.notice.writeNotCarriedOut` and `shellNotice.dismiss` to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. `npm run i18n:check` must pass.

**Checkpoint**: All Phase 2 tests pass. Any identity change in the app unmounts, clears, renews and
re-renders as research R4 describes; the user stories can start.

---

## Phase 3: User Story 1 - Manage domain administrators and their domains (Priority: P1) 🎯 MVP

**Goal**: The domain administrator list (cards and table, search, filters, sorts, paging), the
creation form with domains, sign-in requirements and permissions, the detail screen with its
sections, status changes, second-factor suspension, removal and bulk actions.

**Independent Test**: Against the mock, as an administrator at 360 px and desktop, list, search,
filter, create, edit, rename, suspend second factors of and remove domain administrators, and check
every request, every field error and every loading, empty and error state.

### Tests for User Story 1 (write first; must fail)

- [ ] T020 [US1] Implement the domain administrator handlers and scenarios (research R20):
  - `tests/mocks/handlers/domain-admins.ts`:
    - `listDomainAdmins`: `q` over the username and the ASCII and Unicode domain names, `active`, `secondFactorStatus`, `forcePasswordChange`, `forceSecondFactorSetup`, repeated `domain` (≤ 100), `permission` with `permissionValue` (default `true`; a missing record counts as every flag `false`), the sorts `username`, `active`, `createdAt`, `modifiedAt`, `domainCount` with ties by username, `order`, `limit` (default 25, max 1000), `offset`, `meta.total`;
    - `createDomainAdmin`: username trimmed and lower-cased, then `invalidFormat` (`format: accountUsername`) unless only `a-z 0-9 . _ -` with at least one letter or digit, `tooLong` above 255, `reserved` for `api`; `409 account-exists` across both roles, case-insensitively; domains normalised, `notFound`, `notEligible` (`kind: aliasDomain`) and `invalidFormat` (`format: domainName`) on `domains.<i>`, duplicates merged; the password policy codes of feature 003; unsent permission flags get `accountDefaults`; `201` with `Location` and `ETag`;
    - `getDomainAdmin` (any letter case; an administrator's name is `404`);
    - `updateDomainAdmin`: JSON Merge Patch, `If-Match`/`412`, `immutable` for changed read-only members, `unknownField`, the rename rules and `409`, `domains` replacing the set (at least one, existing assignments keep their times and status, non-domain assignments dropped), `permissions` merge (creating a missing record with unsent flags `false`), `active` applied to the assignments; `ETag` on `200`;
    - `deleteDomainAdmin` (`If-Match`, `204`), `suspendDomainAdminSecondFactors` (`active` entries become `suspended`; passkeys unchanged);
    - `applyDomainAdminBulkAction`: `tooMany` (with `max`) above `bulkLimit`, items in order, each once, outcomes `done` (with the new `version`), `notFound`, `outdated` (`412` problem), `failed`, and the `summary`;
  - `tests/mocks/handlers/admins.ts` with `getAccountCapabilities` from `accountDefaults` (the administrator operations follow in T066);
  - register both in `tests/mocks/handlers/index.ts`;
  - `tests/mocks/scenarios/administrators.ts`, registered in `tests/mocks/scenarios/index.ts`: `domain-admins-three` (an admin session and three domain administrators, one with active second factors), `domain-admins-empty`, `domain-admins-many` (120 domain administrators and 3,000 domains, one account with 40 domains), `domain-admins-edge` (an account without domains, one with an `ALL` assignment, one whose assignment status differs from the account's, one without a permission record, one with a 255-character username), `domain-admins-list-error` (`500` on `listDomainAdmins`), `capabilities-unavailable` (`500` on `getAccountCapabilities`), `domain-admin-changed-elsewhere` (the account changes after it is read), `domain-admin-domain-removed` (a picked domain disappears before the save) and `domain-admins-as-domain-admin` (a domain administrator session).
- [ ] T021 [P] [US1] Write `tests/e2e/administrators/domain-admins-list.spec.ts`:
  - US1-AS1 and FR-006: at 360 px three cards with username, assigned domains, two-factor status and status, the whole card opening the detail, no horizontal scrolling; on desktop a table with sortable headers (`aria-sort`);
  - US1-AS2 and FR-007: a search for part of a domain name narrows the list and survives opening an account and coming back; every filter (status, two-factor status, pending requirement, assigned domain, permission flag value), every sort and the pagination with the total are kept in the address, survive a reload, and are sent as the contract's parameters (asserted through `mockApi.requests()`);
  - FR-005: the first three domains and "+N more", the "No domains" warning, the "not a domain" marker, two-factor "suspended until next sign-in"; status and two-factor status as text (FR-069);
  - FR-008: "Add domain administrator" reachable with one tap at 360 px;
  - US1-AS9: the empty state explains domain administrators and offers "Add domain administrator"; with filters, "No matches" and "Clear filters";
  - US1-AS10 and FR-004: the loading state, then the translated error with a retry, while the navigation keeps working;
  - FR-001: on `domain-admins-as-domain-admin`, the section is not in the navigation and its addresses show UI 001's "no access" state with no `listDomainAdmins` request;
  - FR-003 and research R3: `/ng/administrators` opens the domain administrator list; the section tab bar links to the administrator list with `aria-current` on the active tab;
  - Edge (many domains): a card of an account with 40 domains shows three and "+37 more".
- [ ] T022 [P] [US1] Write `tests/e2e/administrators/domain-admin-create.spec.ts`:
  - US1-AS3 and FR-017: a username, two domains from the picker, a policy-conforming password, "unlimited quota" turned off in the Permissions section, save: the request body holds `permissions: { unlimitedQuota: false }` only, a translated success message names the account, and its detail screen opens (asserted with `mockApi.requests()`);
  - US1-AS4 and FR-012: no domain, a password missing a policy rule, and a username with characters other than `a–z`, `0–9`, `-`, `_` and `.` each block saving with a message on the field; `api` in any case is refused; on blur ` Reseller.One ` becomes `reseller.one`, with the hint about allowed characters;
  - US1-AS5: an existing username in another case shows "already exists" on the username field and keeps every value;
  - FR-011: the sections Account (active on by default), Domains, Sign-in requirements (both off) and Permissions, as a full page at 360 px;
  - FR-013: at 360 px the picker opens full screen with a search field and checkboxes; "Load more" pages through 3,000 domains (`domain-admins-many`); the selection shows as removable chips; Escape discards;
  - FR-014: show and hide, "Generate" fills a policy-conforming password, reveals it and offers to copy; leaving the page and coming back shows an empty field;
  - FR-015: Permissions starts collapsed with the defaults from the capabilities and a note; on `capabilities-unavailable` the section shows an error with a retry and the form still saves without `permissions`;
  - FR-016 and Edge (domain removed while the form is open): on `domain-admin-domain-removed` the save shows a field error naming the removed domain on its chip and keeps the other values;
  - Edge (network failure during a save): `route.abort()` keeps the values, shows a translated network error with a retry, and reports nothing as saved;
  - SC-001: the whole creation at 360 px with keyboard and touch completes in under 2 minutes of test time without horizontal scrolling.
- [ ] T023 [P] [US1] Write `tests/e2e/administrators/domain-admin-detail.spec.ts`:
  - FR-018: the sections Account, Domains, Sign-in and security, Permissions, One-time sign-in link and the History link exist (the last three filled by US3, US5 and US7); at 360 px a section index leads to each; `/…/domain-admins/<name>#domains` opens with that section in view (FR-003);
  - US1-AS6 and FR-022: add a domain and remove another, save: the request holds exactly the new set as ASCII names with `If-Match`; an empty selection is refused visibly; each domain links to UI 002's domain screen; a non-domain assignment shows its warning and is not part of the edit selection; a differing assignment status shows its own badge;
  - FR-019: each section saves only its changed fields with the etag read; leaving with unsaved changes asks for confirmation;
  - FR-020 and FR-021: a rename confirms that the account's open sessions and any acting session on it end, then the address shows the new name; an empty password field keeps the password, a new one is sent once;
  - FR-023: the two forced flags with their explanations, the product name taken from the branding configuration;
  - US1-AS7 and FR-024: "Suspend two-factor authentication until next sign-in" asks for a confirmation that states password-only sign-in until the next sign-in and that passkeys keep working; afterwards the status shows "suspended until next sign-in";
  - FR-026: activating and deactivating need no confirmation; the message states the effect (sessions end, API keys stop working until reactivated); a refusal restores the previous state;
  - FR-066 and Edge (concurrent edit): on `domain-admin-changed-elsewhere` the save explains the account was changed elsewhere, keeps the input, marks the changed values and offers to load the current values;
  - Edge: the account without a permission record and the one without domains open normally, with their warnings;
  - Edge (removed with its last domain): an unknown username shows "not found" with a link back to the list;
  - FR-004: the detail's loading and error states with a retry.
- [ ] T024 [P] [US1] Write `tests/e2e/administrators/domain-admin-remove-and-bulk.spec.ts`:
  - US1-AS8 and FR-025: "Remove" opens a dialog naming the account and its domains and stating that its API keys are revoked permanently, its passkeys and second factors are removed, its sessions end and the domains and mailboxes stay; the confirm control reads "Remove domain administrator"; confirming returns to the list without the account and announces the result; cancelling changes nothing; focus returns to the trigger (FR-068);
  - FR-009: a selection mode on phones and checkboxes on desktop; Activate, Deactivate, Suspend two-factor authentication and Remove apply to the selection; Remove lists the selected accounts and requires their number typed;
  - FR-010: exactly one `applyDomainAdminBulkAction` request with `{ id, version }` per account (asserted with `mockApi.requests()`), a busy state, then a summary with one translated result per account; failed and outdated accounts stay selected, `done` ones are updated in the list; the result is announced (FR-070);
  - Edge (multi-select partly fails): a mixed result keeps exactly the failed accounts selected and allows a retry;
  - conventions: a dropped connection (`route.abort()`) reports "outcome unknown" and sends no second request; changing the page, search, filters, sort or size clears the selection.
- [ ] T025 [P] [US1] Write `tests/unit/features/administrators/list-state.spec.ts` for the domain administrator schema of data-model §5: every parameter mapped to the contract's query (`status` → `active`, `tfa` → `secondFactorStatus`, `pending` → the forced flag, repeated `domain` (≤ 100), `permissionValue` sent only with `permission`), defaults omitted from the address, `size` limited to 25, 50 or 100, invalid values normalised with `replace`.
- [ ] T026 [P] [US1] Write `tests/unit/features/administrators/username.spec.ts` (data-model §6): trimming and lower-casing; required; at most `usernameMaxLength` from the capabilities; "only `a-z`, `0-9`, `.`, `_` and `-`, with at least one letter or digit"; `api`, `API` and `Api` refused; `...` and `_-` refused; `reseller.1` accepted.
- [ ] T027 [P] [US1] Write `tests/unit/features/administrators/bulk.spec.ts` for domain administrators (data-model §2 `BulkPlan`): targets carry `id` = username and `version` = etag; a selection above `bulkLimit` is refused; `suspendSecondFactors` leaves out accounts whose status is not `active` and reports them.
- [ ] T028 [P] [US1] Write `tests/unit/features/administrators/permissions.spec.ts` and `tests/unit/features/administrators/PermissionsEditor.spec.ts` (research R16):
  - every value of `domainAdminPermissionNameValues` belongs to the group of FR-028 in the stated order, and an unknown plain value lands in "Other";
  - `changedFlags(base, current)` returns only differing flags;
  - the editor renders one `<fieldset>` with a `<legend>` per group, one labelled Reka `Switch` per flag with its explanation referenced by `aria-describedby`, operable by keyboard, and emits the new flag set.
- [ ] T029 [P] [US1] Write `tests/unit/features/administrators/DomainPicker.spec.ts`: chips with `unicodeName` and the ASCII name as title; the dialog's search debounced by 300 ms over `listDomains` with `limit: 25` and "Load more"; "Done" applies, Escape and "Cancel" discard; the emitted value is ASCII names; at least one is required; a server error at `domains.<i>` marks that chip with its message.
- [ ] T030 [P] [US1] Write `tests/unit/features/administrators/account-components.spec.ts` for `AccountStatusBadge.vue`, `SecondFactorStatusBadge.vue` (a text for every value of `accountSecondFactorStatusValues`), `DomainAdminCard.vue` (three domains and "+N more", the two warnings, an assignment badge when its status differs), `AccountActionsMenu.vue` (Edit, Activate or Deactivate by status, Suspend only when `active`, Remove, a slot for later entries, disabled items with their visible reason), `UsernameField.vue` (blur normalisation, hint, field errors) and `SignInRequirementsFields.vue` (two switches with explanations, the product name from branding).
- [ ] T031 [P] [US1] Write `tests/unit/features/administrators/confirmations.spec.ts`: the removal content for a domain administrator (account, domains, API keys revoked permanently, passkeys and second factors removed, sessions end, domains and mailboxes stay) and for an administrator (FR-038); the confirm labels; the rename texts for another account and for the own account (FR-021); the suspension text (FR-024).
- [ ] T032 [P] [US1] Write `tests/smoke/administrators.smoke.spec.ts` against the dev stack: as `admin`, create `smoke-da-<random>` with one seeded domain and a generated password, find it by searching its domain, add a second domain, suspend its second factors, deactivate and activate it, and remove it; nothing touches `admin` or `reseller`.

### Implementation for User Story 1

- [ ] T033 [US1] Implement in `src/features/administrators/`:
  - `api.ts`: the domain administrator list, detail, create, update (through `useVersionedSave`), delete, suspension and bulk operations, `useAccountCapabilities()` (key `['capabilities','accounts']`, 5 min) and the picker's `useInfiniteQuery` over `listDomains`, with the invalidation of data-model §3;
  - `list-state.ts` (domain administrator schema), `username.ts`, `bulk.ts` (domain administrator rules), `permissions.ts` and `confirmations.ts`,

  so that T025, T026, T027, T031 and the logic part of T028 pass.
- [ ] T034 [P] [US1] Implement `AccountStatusBadge.vue`, `SecondFactorStatusBadge.vue`, `AccountActionsMenu.vue` (Reka `DropdownMenu`), `AccountBulkBar.vue` (on UI 002's `useBulkSelection`, with `ConfirmDialog` `requireTyped` for Remove and `BulkResultSummary`), `UsernameField.vue` and `SignInRequirementsFields.vue` in `src/features/administrators/components/`, so that T030 passes.
- [ ] T035 [P] [US1] Implement `DomainPicker.vue`, `DomainPickerDialog.vue` (Reka `Dialog`, full screen below `md`) and `DomainAssignmentList.vue` (links to UI 002's domain detail route, warnings, assignment badges) in `src/features/administrators/components/`, so that T029 passes.
- [ ] T036 [P] [US1] Implement `src/features/administrators/components/PermissionsEditor.vue`, so that T028 passes.
- [ ] T037 [US1] Provide the password field for the account forms (research R22): use `src/shared/components/PasswordField.vue` when UI 003 or UI 005 already promoted it; otherwise move UI 003's password field with its generator and policy hints, and its tests, to `src/shared/components/PasswordField.vue` and `tests/unit/shared/components/PasswordField.spec.ts` without behaviour change, and update UI 003's imports. The value stays in the form's local state and is cleared on unmount (FR-014).
- [ ] T038 [US1] Implement the list: `DomainAdminCard.vue`, `DomainAdminTable.vue`, `DomainAdminFilters.vue` (native selects, the domain filter through `DomainPicker`, the permission filter as a flag select plus on/off) in `src/features/administrators/components/`, the section tab bar (`src/shared/components/SectionTabs.vue` when UI 004 promoted one, otherwise `src/features/administrators/pages/AdministratorsSectionTabs.vue`), and `src/features/administrators/pages/DomainAdminsPage.vue` (`useListState`, `ListState`, `PaginationBar`, `AccountBulkBar`, page sizes 25/50/100).
- [ ] T039 [US1] Implement `src/features/administrators/pages/DomainAdminCreatePage.vue`: the four sections of FR-011 with the capabilities' defaults, the Permissions section in a collapsed Reka `Collapsible` with the defaults note and its own error state, `useProblemForm` mapping `username`, `password`, `domains.<i>` and `permissions.<name>`, one `createDomainAdmin` request with only the differing flags, then the success message and `router.replace` to the detail.
- [ ] T040 [US1] Implement the detail: `AccountSection.vue` (username, status, dates; edit username with the rename confirmation, status, new password), `DomainsSection.vue`, `SignInSecuritySection.vue` (status, passkey count, forced flags, the suspension action) and `DetailSectionIndex.vue` (or UI 002's `src/shared/components/SectionIndex.vue`) in `src/features/administrators/components/`, all on UI 002's `EditableSection`, and `src/features/administrators/pages/DomainAdminDetailPage.vue` with the not-found state, the removal through `useConfirm`, the unsaved-changes guard (`onBeforeRouteLeave`) and empty slots for US2, US3, US5 and US7.
- [ ] T041 [US1] Implement `src/features/administrators/routes.ts` (`administrators` redirect, `domain-admins`, `domain-admin-create`, `domain-admin-detail`, with `meta.navEntry: 'administrators'` and the param pattern `[A-Za-z0-9._-]{1,255}`) and `src/features/administrators/index.ts`; register the routes in `src/app/router/routes.ts`, and set the catalogue entry `administrators` to `available` in `src/app/navigation/catalogue.ts`.
- [ ] T042 [US1] Translations for US1:
  - First write `tests/unit/i18n/legacy-keys-007.spec.ts`, which asserts that each legacy key listed under the spec's "Legacy Parity" is a value of `src/i18n/legacy-map.json`, with this story's keys (`admin.domain_admins`, `admin.domain_admin`, `admin.add_domain_admin`, `admin.admin_domains`, `admin.search_domain_da`, `admin.username`, `admin.password`, `admin.active`, `admin.action`, `edit.domain_admin`, `edit.domains`, `edit.force_pw_update`, `edit.force_pw_update_info`, `tfa.tfa`, `tfa.disable_tfa`, `tfa.force_tfa`, `tfa.force_tfa_info`, `mailbox.activate`, `mailbox.deactivate`, `mailbox.remove`, `mailbox.active`, `mailbox.inactive`, `danger.username_invalid`, `danger.object_exists`, `danger.domain_invalid`, `danger.password_complexity`, `success.domain_admin_added`, `success.domain_admin_modified`, `success.domain_admin_removed` and the 19 `acl.*` flag labels). It must fail.
  - Add the `accounts.*`, `domainAdmins.*`, `permissions.*` (group names, `permissions.flag.<name>` mapped to the legacy `acl.<column>` labels, `permissions.explanation.<name>`), `problem.account-exists`, `validation.format.accountUsername`, `accounts.validation.reservedUsername` and `domainAdmins.validation.domainRequired` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` and the mappings to `src/i18n/legacy-map.json`. Supply cs-cz and sk-sk values in the app layer for `tfa.force_tfa`, `tfa.force_tfa_info` and `acl.alias_external_goto`, which upstream lacks. Run `npm run i18n:import`. T042's test and `npm run i18n:check` must pass.

**Checkpoint**: US1 works on its own: all T020–T032 tests pass. This is the MVP.

---

## Phase 4: User Story 2 - Act as a domain administrator or mailbox user, then return (Priority: P1)

**Goal**: "Sign in as" from the domain administrator and mailbox screens, the acting banner on every
screen, the one-tap return to the origin, "Sign out completely", credential controls unavailable
while acting, automatic ends and the behaviour across tabs.

**Independent Test**: Start acting as a mailbox user and as a domain administrator from each entry
point, visit every screen available to the target, and return explicitly and through an
"impersonation ended" refusal; check the banner on every screen at both viewports, that no data of
the previous identity is shown after either switch, and that the user lands on the origin screen.

**Depends on**: US1 (the domain administrator entry points) and UI 003 (the mailbox entry points).

### Tests for User Story 2 (write first; must fail)

- [ ] T043 [US2] Implement the impersonation mock, the tab fixture and the scenarios (research R20):
  - `tests/mocks/handlers/impersonation.ts`: `startImpersonation` with the checks of API 007 R16 in order (`pending-action-required`, `409 already-impersonating`, `403 forbidden` for a mailbox user caller or a domain administrator target named by a domain administrator, `403 permission-flag-required` with `requiredFlags: [loginAs]` before any lookup, `422`, `404` for unknown accounts, resources, administrators and mailboxes outside a domain administrator's active assignments), inactive targets allowed, `201` with `Location: /api/v2/session/impersonation` and `ImpersonationStarted` (identity and a new `csrfToken`); `endImpersonation` (`204`, a no-op without an impersonation); `getImpersonation`; register it in `tests/mocks/handlers/index.ts`;
  - `tests/mocks/handlers/identity.ts`: while impersonating, the target's username, role and scope, the effective flags of API 007 R18 (an administrator impersonator: every flag `true`; a domain administrator impersonator: every mailbox user flag `true`, then the impersonator's `da_acl` values for `syncjobs`, `quarantine`, `appPasswds`, `pushover`, `spamPolicy` and the 14 `da_acl`-only flags), the impersonator's `authentication`, `pendingActions` and `preferences`, the `impersonation` member, and `webmailOnBehalfEnabled` for administrator and domain administrator identities;
  - `tests/mocks/handlers/auth.ts`: a helper that renews the anti-forgery token on every start, end and automatic end, so that requests with the old token get `403 csrf-token-mismatch`; `deleteSession` ends the whole session while acting; `getSession` reports `impersonation`;
  - `tests/mocks/handlers/index.ts`: a wrapper that, when `invalidateImpersonation` is set, answers the next session request except `endImpersonation` and `deleteSession` with `403 impersonation-ended`, ends the impersonation and renews the token (`endImpersonation` and `deleteSession` end it and complete normally); and a wrapper that answers `403 not-allowed-while-impersonating` to the passkey operations of `tests/mocks/handlers/passkeys.ts` and the credential and webmail hand-off operations of UI 005's `tests/mocks/handlers/self-service.ts` while acting;
  - `tests/e2e/fixtures/tabs.ts`: `openSecondTab(context)` (same context, shared cookie and BroadcastChannel) and `startImpersonationOutOfBand(context, target)`, which calls `POST /api/v2/session/impersonation` through `context.request` with the session cookie and a fresh token, so no broadcast reaches the pages;
  - `tests/mocks/scenarios/acting.ts`, registered in `tests/mocks/scenarios/index.ts`: `acting-admin` (an admin with UI 003's mailboxes, including `alice@example.org` and an inactive mailbox, and domain administrators, including `reseller` and an inactive one), `acting-reseller-login-as` and `acting-reseller-no-login-as` (a domain administrator of two domains with and without `loginAs`), `acting-already` (a session already impersonating `alice@example.org`, with the impersonator's other tab), `acting-long-names` (a 200-character local part and a 255-character domain administrator username) and `acting-target-forced` (a target with a forced password change).
- [ ] T044 [P] [US2] Write `tests/e2e/acting/acting-mailbox-user.spec.ts`:
  - US2-AS1 and FR-043: on `acting-admin`, "Sign in as" in the mailbox list's action menu opens the mailbox user's home; the banner names `alice@example.org`, "mailbox user", `admin` and the start time; the polite live region announces the switch; no confirmation was asked; SC-002: two taps from the list entry;
  - FR-041: the same from UI 003's mailbox detail screen;
  - US2-AS2, FR-044 and SC-003: on every screen the target can open (home, My account, quarantine, spam filter, passkeys) the banner is at the top, outside any menu, stays visible while scrolling, pushes the content down, and carries an icon and text; on no screen after returning;
  - US2-AS3, FR-046 and SC-005: "Return to admin" (one tap, no confirmation, at least 44 × 44 px) shows the mailbox list again with its search, filters and page restored, and announces the return;
  - FR-045: the banner is a named region; the page title starts with the acting prefix while acting and not afterwards;
  - US2-AS7 and FR-047: the account menu offers "Sign out completely", which ends the session and shows the sign-in screen;
  - US2-AS8 and FR-049: the passkeys page's add, rename and remove controls, and UI 005's password change, second factors and recovery e-mail, are unavailable with "Not available while acting as another user";
  - FR-050: changing the language or theme while acting sends `updatePreferences` and keeps the impersonator's choice after returning;
  - SC-004: after the start no text of the administrator's mailbox list is visible, and after the return no text of the mailbox user's screens is visible;
  - Edge (inactive target): the inactive mailbox can be acted as;
  - Edge (target's forced actions): on `acting-target-forced` the session is not restricted;
  - Edge (long usernames): on `acting-long-names` at 360 px the local part is shortened with an ellipsis in the middle and the domain stays visible; tapping or focusing the name shows the full text, which is also the accessible name.
- [ ] T045 [P] [US2] Write `tests/e2e/acting/acting-domain-admin.spec.ts`:
  - US2-AS5: every entry of the domain administrator list offers "Sign in as", inactive ones included; no entry of the administrator list offers it; the detail screen offers it too (FR-041);
  - acting as `reseller` shows the domain administrator's navigation and home with its effective flags (FR-048), and the banner names "domain administrator";
  - US2-AS4: on `acting-reseller-login-as`, every mailbox of the reseller's domains offers "Sign in as"; on `acting-reseller-no-login-as`, none does;
  - US2-AS6: while acting, no screen offers "Sign in as";
  - FR-042: on `acting-already` a start answered `already-impersonating`, a start answered `permission-flag-required`, and a `404` each show a translated message and leave the user in their own view.
- [ ] T046 [P] [US2] Write `tests/e2e/acting/acting-ended.spec.ts`:
  - US2-AS9 and FR-051: while acting, `mockApi.patch({ invalidateImpersonation: 'targetDeletedOrRenamed' })`, then a navigation or a save: the message says acting ended because the account is no longer available and the action was not carried out; the banner disappears; the origin screen opens as the administrator; `mockApi.requests()` shows the refused request was not resent (SC-004);
  - Edge (impersonator deactivated): a `401` while acting shows the sign-in screen with UI 001's session-ended message;
  - Edge (screen not available after a switch): ending acting while on a mailbox-user-only screen whose origin is gone opens the administrator's home, not a forbidden state;
  - Edge (removing an account someone is acting as): another administrator's removal of the target leads to the same message on the next request.
- [ ] T047 [P] [US2] Write `tests/e2e/acting/acting-tabs.spec.ts`:
  - FR-054: starting acting in one tab shows the banner and the target's view in the second tab without a reload, and returning removes it there;
  - US2-AS10, FR-053 and SC-004: with a form changed in the second tab, `startImpersonationOutOfBand()`, then saving in the second tab: the change is not carried out, the tab explains that the account changed in another tab, then shows the banner and the target's view; `mockApi.requests()` holds the one refused write and no replay;
  - FR-052: the second tab shows no data of the previous identity after either switch.
- [ ] T048 [P] [US2] Write `tests/unit/features/acting/eligibility.spec.ts`, table-driven over data-model §2: roles × target kinds × acting or not × pending actions × `loginAs` × domain in or out of scope; administrators never as targets.
- [ ] T049 [P] [US2] Write `tests/unit/app/shell/ActingBanner.spec.ts` and `tests/unit/app/router/title-acting.spec.ts` (research R7): a `<section>` named by its title; the target, role, impersonator and start time (time only today, date and time otherwise, in the user's locale); the return button's label and size classes; the address split into a shrinking local part and a fixed `@domain`, other usernames truncated at the end; the toggle with `aria-expanded` and the full text as accessible name; no live region inside; the token classes; rendered by both layouts only while acting; the title prefix only while acting.
- [ ] T050 [P] [US2] Write `tests/unit/features/acting/SignInAsAction.spec.ts`, `tests/unit/features/acting/useActingState.spec.ts` and `tests/unit/features/acting/ActingUnavailableNotice.spec.ts`: nothing rendered when `canSignInAs` is false; the origin recorded before the request; `startImpersonation` with `role` and `username`; on `201`, `switchIdentity({ reason: 'actingStarted', identity, csrfToken })`; refusals mapped to their messages; the notice text and its association with the disabled control.
- [ ] T051 [P] [US2] Write `tests/unit/app/shell/UserMenu-acting.spec.ts`: "Sign out completely" while acting, "Sign out" otherwise, both calling UI 001's sign-out.
- [ ] T052 [P] [US2] Write `tests/smoke/acting.smoke.spec.ts`: as `admin`, "Sign in as" `alice@example.org` from the mailbox list, see the banner on two screens, return to the list with its search; "Sign in as" `reseller` from the domain administrator list and return.

### Implementation for User Story 2

- [ ] T053 [US2] Implement `src/features/acting/api.ts` (`startImpersonation`, `endImpersonation`), `src/features/acting/eligibility.ts`, `src/features/acting/composables/useActingState.ts` and `src/features/acting/index.ts`, so that T048 and part of T050 pass.
- [ ] T054 [P] [US2] Implement `src/features/acting/components/SignInAsAction.vue` (a menu item or button variant by prop) and `src/features/acting/components/ActingUnavailableNotice.vue`, so that T050 passes.
- [ ] T055 [P] [US2] Implement `src/app/shell/ActingBanner.vue` with the `ResizeObserver` that sets `--shell-sticky-height` (used by `scroll-padding-top` in `src/styles/main.css`), place it at the top of the sticky region in `src/app/layouts/ShellLayout.vue` and `src/app/layouts/AuthLayout.vue`, and add the acting prefix in `src/app/router/title.ts`, so that T049 passes.
- [ ] T056 [US2] Wire "Return to {impersonator}" in `src/app/shell/ActingBanner.vue` (`endImpersonation`, then `switchIdentity({ reason: 'actingEnded' })`; a network failure keeps acting and shows a retry) and "Sign out completely" in `src/app/shell/UserMenu.vue`, so that T051 passes.
- [ ] T057 [US2] Add the entry points (FR-041): `SignInAsAction` in `src/features/administrators/components/AccountActionsMenu.vue` (domain administrators only) and in the header actions of `src/features/administrators/pages/DomainAdminDetailPage.vue`; and in UI 003's mailbox list entry action menu `src/features/mailboxes/components/MailboxActionsMenu.vue` and mailbox detail action area `src/features/mailboxes/pages/MailboxDetailPage.vue` (or the components UI 003's tasks name for these areas, research R22), passing the mailbox's address and domain.
- [ ] T058 [US2] Make the credential controls unavailable while acting (FR-049) with `useActingState()` and `ActingUnavailableNotice`: UI 001's `src/features/passkeys/pages/PasskeysPage.vue`, `src/features/passkeys/components/AddPasskeyForm.vue`, `src/features/passkeys/components/PasskeyCard.vue` and `src/features/passkeys/components/RenamePasskeyDialog.vue`; UI 005's own password, second-factor and recovery e-mail screens in `src/features/account/` (the pages and forms UI 005's tasks name). Map `not-allowed-while-impersonating` from these screens to the same text.
- [ ] T059 [US2] Translations for US2: first add `success.logged_in_as` to `tests/unit/i18n/legacy-keys-007.spec.ts` (must fail); then add the `acting.*` messages (banner title and line, role names, return, toggle, title prefix, announcements, "Sign in as", unavailable reason), `userMenu.signOutCompletely`, `problem.already-impersonating`, `problem.impersonation-ended`, `problem.not-allowed-while-impersonating` and the `loginAs` flag name for `problem.permission-flag-required` to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, and the `success.logged_in_as` mapping to `src/i18n/legacy-map.json`. Run `npm run i18n:import`; the test and `npm run i18n:check` must pass.

**Checkpoint**: US1 and US2 work on their own; acting is complete except webmail (US6).

---

## Phase 5: User Story 3 - Set a domain administrator's permissions (Priority: P2)

**Goal**: The Permissions section of the domain administrator detail screen: grouped switches,
saving only changed flags with the version read, the leave guard and outdated handling.

**Independent Test**: Open a domain administrator, change several flags, save, reload, and check the
request, the success message, the unsaved-changes guard, the outdated handling and the error state.

**Depends on**: US1 (`PermissionsEditor.vue` and the detail screen).

### Tests for User Story 3 (write first; must fail)

- [ ] T060 [US3] Add the scenarios `domain-admin-permissions-fail` (`500` on `updateDomainAdmin` for a `permissions` patch) and `domain-admin-permissions-changed-elsewhere` (the flags change after the read) to `tests/mocks/scenarios/administrators.ts`.
- [ ] T061 [P] [US3] Write `tests/e2e/administrators/permissions.spec.ts`:
  - US3-AS1, FR-027 and FR-028: 19 switches with translated labels and explanations in the groups Mailbox settings, Domain settings, Spam and quarantine and Access, reflecting the stored state;
  - US3-AS2 and FR-029: three changed switches send `{ permissions: { … three flags … } }` with `If-Match`, a translated success message appears and is announced, and a reload shows the saved state;
  - US3-AS3: leaving with changed switches asks whether to discard them;
  - US3-AS4 and FR-066: on `domain-admin-permissions-changed-elsewhere` the save explains the account was changed elsewhere, keeps the switches and offers to load the current values;
  - US3-AS5: on `domain-admin-permissions-fail` the switches keep the choices and a translated message offers a retry;
  - FR-031: an administrator's detail screen has no Permissions section;
  - Edge (no permission record): every switch reads off; saving creates the record (the request holds only the changed flags);
  - SC-010: from opening the account at 360 px to the saved result in under 30 seconds of test time; the switches work with the keyboard alone.
- [ ] T062 [P] [US3] Write `tests/unit/features/administrators/PermissionsSection.spec.ts`: the diff against the read flags, `If-Match` with the latest etag, the guard registration while dirty, the switches kept on `412` and on failure, the "load current values" action.
- [ ] T063 [P] [US3] Add to `tests/smoke/administrators.smoke.spec.ts` a case that turns `aliasDomains` on for the smoke domain administrator, reloads and sees it on, then removes the account.

### Implementation for User Story 3

- [ ] T064 [US3] Implement `src/features/administrators/components/PermissionsSection.vue` on UI 002's `EditableSection` and `PermissionsEditor.vue`, and mount it in `src/features/administrators/pages/DomainAdminDetailPage.vue`, so that T061 and T062 pass.
- [ ] T065 [US3] Translations for US3: first add `success.acl_saved` to `tests/unit/i18n/legacy-keys-007.spec.ts` (must fail); then add the `permissions.section.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` and the `success.acl_saved` mapping to `src/i18n/legacy-map.json`. Run `npm run i18n:import`; the test and `npm run i18n:check` must pass.

**Checkpoint**: US1 to US3 work on their own.

---

## Phase 6: User Story 4 - Manage administrator accounts (Priority: P2)

**Goal**: The administrator list, creation and detail screens with the own-account and
last-administrator protections, self-deactivation, self-rename and bulk actions.

**Independent Test**: List, create, edit, rename, deactivate and remove administrators, including
the own account and the last active administrator, and check every protection, confirmation and
message.

**Depends on**: US1 (the shared account components and `api.ts`).

### Tests for User Story 4 (write first; must fail)

- [ ] T066 [US4] Implement the administrator handlers and scenarios:
  - `tests/mocks/handlers/admins.ts`: `listAdmins` (`q`, `active`, `secondFactorStatus`, the forced flags, the sorts `username`, `active`, `createdAt`, `modifiedAt`, paging, `meta.total`), `createAdmin` (the username rules and `409` of T020, password policy, `201` with `Location` and `ETag`), `getAdmin`, `updateAdmin` (merge patch, `If-Match`/`412`, `409 last-active-admin` when `active: false` would leave none active, never for changes that keep the count; a self-deactivation answers `200` and ends the session at its next request; a self-rename keeps the session under the new name; renaming another account ends its sessions and impersonations of it), `deleteAdmin` (`409 cannot-delete-own-account`, `409 last-active-admin`), `suspendAdminSecondFactors` and `applyAdminBulkAction` (items in order; the item that would leave none active is `refused` with `last-active-admin`; the own account is `refused` with `cannot-delete-own-account`);
  - `tests/mocks/scenarios/administrators.ts`: `admins-one-active` (the signed-in admin is the only active one, plus an inactive one), `admins-two-active`, `admins-many` (60 administrators), `admin-changed-elsewhere` and `admins-concurrent-last` (`updateAdmin` answers `last-active-admin` although two are listed as active).
- [ ] T067 [P] [US4] Write `tests/e2e/administrators/admins.spec.ts`:
  - US4-AS1 and FR-032: at 360 px one card per account with username, two-factor status, status and the "You" marker on the own account; a table on desktop; search, the filters status, two-factor status and pending requirement, the sorts without "number of domains", kept in the address;
  - US4-AS2 and FR-033: create an administrator with a valid username and a policy-conforming password; the success message names it; the form has the Account and Sign-in requirements sections only;
  - US4-AS3 and FR-035: on the own account, "Remove" is disabled in the actions menu and on the detail screen with "You cannot remove the account you are signed in with";
  - US4-AS4 and FR-036: on `admins-one-active`, deactivation of that account is disabled in the menu and on the edit screen with "At least one administrator must stay active", for the account's own user and on another admin's view;
  - US4-AS5 and FR-037: on `admins-two-active`, deactivating the own account asks for a confirmation that warns the session ends; confirming saves and then shows the sign-in screen with a translated explanation;
  - US4-AS6 and FR-021: renaming the own account confirms the new username for the next sign-in; afterwards the user menu shows the new name, the address shows the new name, and the session continues; renaming another account confirms that its sessions and any acting session on it end;
  - US4-AS7 and FR-039: on `admins-concurrent-last` the refused deactivation shows its translated message and the account keeps its previous state;
  - FR-038: the removal dialog names the account and states that its API keys are revoked permanently and its passkeys and second factors are removed; the confirm control reads "Remove administrator";
  - FR-031 and FR-034: the detail screen has Account, Sign-in and security and "View history", and no Permissions or one-time link;
  - FR-066: on `admin-changed-elsewhere` a save keeps the input and offers the current values.
- [ ] T068 [P] [US4] Write `tests/e2e/administrators/admins-bulk.spec.ts`:
  - FR-035: a bulk Remove and a bulk Deactivate that include the own account send targets without it, and the summary says the own account was left out;
  - FR-036: a bulk Deactivate that would leave no active administrator is stopped before any request, with "At least one administrator must stay active" (`mockApi.requests()` holds no `applyAdminBulkAction`);
  - per-item `refused` results (`last-active-admin`, `cannot-delete-own-account`) are translated and stay selected; Remove requires the typed number.
- [ ] T069 [P] [US4] Extend `tests/unit/features/administrators/list-state.spec.ts` with the administrator schema, `tests/unit/features/administrators/bulk.spec.ts` with the administrator rules of data-model §2 (`excludedOwn`, `blocked: 'lastActiveAdmin'` when the selected active accounts are at least `activeAdminCount`), and `tests/unit/features/administrators/account-components.spec.ts` with `AdminCard.vue` ("You" marker) and the disabled reasons of `AccountActionsMenu.vue` for the own account and the last active administrator.
- [ ] T070 [P] [US4] Write `tests/unit/features/administrators/own-account-flows.spec.ts`: after a self-deactivation `200`, `GET /session` reporting `anonymous` runs UI 001's session end with the notice `selfDeactivated`; after a self-rename `200`, `switchIdentity({ reason: 'selfRenamed' })` targets `admin-detail` with the new name and the old detail key is removed from the cache.
- [ ] T071 [P] [US4] Write `tests/smoke/admins.smoke.spec.ts`: as `admin`, the list shows `admin` with "You" and its Remove disabled; create `smoke-admin-<random>`, deactivate and activate it, and remove it; `admin` itself is never changed.

### Implementation for User Story 4

- [ ] T072 [US4] Extend `src/features/administrators/api.ts` with the administrator list, detail, create, update, delete, suspension and bulk operations and the active-administrator count (key `['admins','active-count']`, `listAdmins({ active: true, limit: 1 })`), `src/features/administrators/list-state.ts` with the administrator schema and `src/features/administrators/bulk.ts` with the administrator rules, so that T069's logic cases pass.
- [ ] T073 [P] [US4] Implement `AdminCard.vue`, `AdminTable.vue` and `AdminFilters.vue` in `src/features/administrators/components/`, and the own-account and last-administrator reasons in `AccountActionsMenu.vue`, so that T069 passes.
- [ ] T074 [US4] Implement `src/features/administrators/pages/AdminsPage.vue` (`useListState`, `ListState`, `PaginationBar`, `AccountBulkBar` with the administrator rules, the section tab bar).
- [ ] T075 [US4] Implement `src/features/administrators/pages/AdminCreatePage.vue` (Account and Sign-in requirements sections, `UsernameField`, `PasswordField`, `useProblemForm`, success message, `router.replace` to the detail).
- [ ] T076 [US4] Implement `src/features/administrators/pages/AdminDetailPage.vue` with `AccountSection` (the own-rename confirmation and `selfRenamed` switch, the last-administrator reason, the self-deactivation confirmation and flow of research R15), `SignInSecuritySection`, the removal confirmation and the own-account reason, so that T070 passes.
- [ ] T077 [US4] Add the routes `admins`, `admin-create` and `admin-detail` to `src/features/administrators/routes.ts`.
- [ ] T078 [US4] Translations for US4: first add `admin.admins`, `admin.add_admin`, `edit.admin`, `warning.no_active_admin`, `warning.cannot_delete_self`, `success.admin_added`, `success.admin_modified` and `success.admin_removed` to `tests/unit/i18n/legacy-keys-007.spec.ts` (must fail); then add the `admins.*` messages (list, form, detail, "You", the reasons "You cannot remove the account you are signed in with" and "At least one administrator must stay active", the self-deactivation and rename confirmations), `problem.last-active-admin` (legacy `warning.no_active_admin`), `problem.cannot-delete-own-account` (legacy `warning.cannot_delete_self`) and `auth.signIn.notice.selfDeactivated` to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with the mappings in `src/i18n/legacy-map.json`. Run `npm run i18n:import`; the test and `npm run i18n:check` must pass.

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

- [ ] T079 [US5] Implement `tests/mocks/handlers/sso-tokens.ts` (`issueDomainAdminSsoToken`: a token matching `^[0-9A-F]{6}(-[0-9A-F]{6}){4}$`, `expiresAt` 30 s after issue, `Cache-Control: no-store`, `409 account-inactive`; `createSessionWithSsoToken`: valid only once and within 30 s, case and surrounding whitespace ignored, replacing any session including an impersonating one, `restricted` with `pendingActions` for forced accounts, `401 sign-in-failed` otherwise, `429` with `Retry-After` after the scenario's failure threshold), register it in `tests/mocks/handlers/index.ts`, and add `tests/mocks/scenarios/sso-sign-in.ts` (registered in `tests/mocks/scenarios/index.ts`) with `sso-valid` (anonymous, a fresh token for `reseller`), `sso-valid-signed-in` (an admin session and the same token), `sso-expired`, `sso-used`, `sso-forced-password-change` and `sso-throttled`.
- [ ] T080 [P] [US5] Write `tests/e2e/sso-sign-in/landing.spec.ts`:
  - US5-AS1, FR-059 and SC-009: `/ng/sign-in/sso-token?sso_token=<token>` signed out reaches the domain administrator's home within 5 seconds; `page.url()` never shows the token after the first script ran, `page.goBack()` never lands on an address with it, and no API request carries it in a URL or `Referer`;
  - US5-AS2 and FR-061: an expired, a used and a malformed token each lead to the sign-in screen with "This sign-in link is invalid or has expired", without a reason, and normal sign-in works;
  - US5-AS3 and FR-060: on `sso-valid-signed-in` the landing asks, naming the current account and "the domain administrator this link was created for"; "Stay signed in as admin" opens home as admin and sends no `createSessionWithSsoToken`; "Continue" signs in as `reseller`, and a second tab of the old session switches too (FR-052);
  - US5-AS4: on `sso-forced-password-change` the restricted session of UI 001 (pending actions) appears;
  - Edge (opened twice): a second opening of the same link shows the invalid-or-expired message;
  - Edge (prefetch): a page opened in a hidden state (init script forcing `document.visibilityState = 'hidden'`) sends no exchange until it becomes visible;
  - Edge (throttled): on `sso-throttled` UI 001's throttling message with its countdown and a link to normal sign-in;
  - the landing without a token opens the sign-in screen.
- [ ] T081 [P] [US5] Write `tests/e2e/sso-sign-in/issue-link.spec.ts`:
  - US5-AS5, FR-062: on an active domain administrator, "Create sign-in link" opens the one-time secret dialog with the full link `…/ng/sign-in/sso-token?sso_token=<token>`, a copy control whose result is announced, the countdown from `expiresAt` (`page.clock`), the warning that opening it in this browser replaces the session, and no control that opens the link;
  - FR-063 and Edge (not copied in time): at zero the link is marked expired, copy is disabled, and "Create new link" issues a new one; closing an unexpired link without copying asks for confirmation;
  - FR-063: after leaving the screen and coming back no link is shown, and `localStorage`, `sessionStorage` and `history.state` never held it;
  - US5-AS6: on an inactive domain administrator "Create sign-in link" is disabled with the reason that the account is inactive; a `409 account-inactive` race shows its message.
- [ ] T082 [P] [US5] Write the unit tests:
  - `tests/unit/features/auth/sso-token-capture.spec.ts`: on the landing path, the token is read, `history.replaceState` removes it (keeping other parameters) before `bootstrap()` is called, and it is held in memory until consumed or discarded; other paths are untouched;
  - `tests/unit/features/auth/useSsoTokenSignIn.spec.ts`: the landing state machine of data-model §7, waiting for `visibilitychange` and `prerenderingchange`, and every outcome (`201` active and restricted, `401`, `422`, `429`, network);
  - `tests/unit/app/router/guards-any-state.spec.ts`: a route with `meta.anySessionState` resolves in the `anonymous`, `pendingSecondFactor`, `restricted` and `active` states;
  - `tests/unit/features/administrators/SsoLinkSection.spec.ts` and `tests/unit/features/administrators/sso-link.spec.ts`: the link built from `location.origin`, the router base and the token; the token requested by a direct client call, with the query and mutation caches empty afterwards; disabled with its reason for an inactive account;
  - `tests/unit/shared/components/OneTimeSecretDialog-expiry.spec.ts`: with `expiresAt` and `serverDate`, the countdown uses the clock skew, is announced at the start and at 10 seconds, ends in the expired state with copy disabled and the "Create new link" slot, and closing an expired link needs no confirmation; without `expiresAt` the dialog behaves as before.
- [ ] T083 [P] [US5] Write `tests/smoke/sso-sign-in.smoke.spec.ts`: as `admin`, create a sign-in link for `reseller` and copy it; open it in a new browser context within its validity and land on the reseller's home; opening it again shows the invalid-or-expired message.

### Implementation for User Story 5

- [ ] T084 [US5] Implement `src/features/auth/sso-token-capture.ts` (exported from `src/features/auth/index.ts`) and call it in `src/main.ts` before the bootstrap; add `createSessionWithSsoToken` to `src/features/auth/api.ts`; implement `src/features/auth/composables/useSsoTokenSignIn.ts` with the state machine of data-model §7, using `switchIdentity({ reason: 'sessionReplaced' })` when a session existed and UI 001's after-sign-in path otherwise.
- [ ] T085 [US5] Implement `src/features/auth/pages/SsoTokenLandingPage.vue` (the question, the busy state, UI 001's `useThrottle` message, the error with "Try again"), add the route `sign-in-sso-token` (`/sign-in/sso-token`, `meta.anySessionState: true`) to `src/features/auth/routes.ts`, let `src/app/router/guards.ts` pass such routes in every state, and add the notice `ssoLinkInvalid` to `src/features/auth/components/SignInNotice.vue`, so that T082's landing and guard cases pass.
- [ ] T086 [P] [US5] Extend `src/shared/components/OneTimeSecretDialog.vue` with the optional props `expiresAt` and `serverDate` (countdown through `useCountdown`, expired state, `create-new` slot) without changing its behaviour for other callers, so that T082's dialog case passes.
- [ ] T087 [US5] Implement `src/features/administrators/sso-link.ts`, the direct `issueDomainAdminSsoToken` call in `src/features/administrators/api.ts`, and `src/features/administrators/components/SsoLinkSection.vue`, and mount the section in `src/features/administrators/pages/DomainAdminDetailPage.vue`.
- [ ] T088 [US5] Translations for US5: add the `ssoSignIn.*` (title, question, continue, stay, busy, error), `ssoLink.*` (action, inactive reason, warning, expired, create new, countdown announcements) and `auth.signIn.notice.ssoLinkInvalid` messages and `problem.account-inactive` to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. `npm run i18n:check` must pass.

**Checkpoint**: US1 to US5 work on their own.

---

## Phase 8: User Story 6 - Open a mailbox's webmail on the user's behalf (Priority: P3)

**Goal**: "Open webmail as" next to "Sign in as" on mailbox entries when the operator allows it, a
new tab without leaving the app, refusals as messages, and webmail unavailable while acting.

**Independent Test**: With the setting reported on and off, check where "Open webmail as" appears for
an administrator and for domain administrators with and without the flag, check that webmail is
unavailable while acting, and check the refusal messages.

**Depends on**: US2 (the acting state and the mailbox entry points of T057) and UI 005 (the Webmail
action).

### Tests for User Story 6 (write first; must fail)

- [ ] T089 [US6] Add `createWebmailSignInOnBehalf` to `tests/mocks/handlers/impersonation.ts` with the checks of API 007 R21 in order (`not-allowed-while-impersonating`, `pending-action-required`, `forbidden` for mailbox users, `permission-flag-required` with `requiredFlags: [loginAs]`, `webmail-on-behalf-disabled` when `allowAdminEmailLogin` is off, `groupware-disabled` when `groupwareEnabled` is off, `404`, `422 notEligible` on `mailbox` with `reason` `mailboxInactive`, `loginDisabled` or `domainInactive`) and `200` with the required `Set-Cookie` and `Cache-Control: no-store` headers and `url: /SOGo/so/`; add the scenarios `webmail-on`, `webmail-off`, `webmail-groupware-disabled` and `webmail-reseller` (with and without `loginAs`) to `tests/mocks/scenarios/acting.ts`; and write `tests/e2e/fixtures/popup.ts` (fulfils `/SOGo/**` with a stub page, records popups, and an option whose init script makes `window.open` return `null`).
- [ ] T090 [P] [US6] Write `tests/e2e/webmail-on-behalf/webmail.spec.ts`:
  - US6-AS1 and FR-056: on `webmail-on`, "Open webmail as" on an active mailbox opens a new tab at the webmail address while the app stays on the list; the same from the mailbox detail screen;
  - US6-AS2 and FR-055: on `webmail-off` no "Open webmail as" appears in the list or the detail; on `webmail-groupware-disabled` neither;
  - US6-AS3: an inactive mailbox and a mailbox whose login is disabled each show their translated refusal and open no tab;
  - FR-055: on `webmail-reseller` the action appears only with `loginAs`, and only for mailboxes of the reseller's domains;
  - US6-AS4 and FR-057: while acting as a mailbox user, UI 005's Webmail action on the user's home is unavailable with "Not available while acting as another user", and no "Open webmail as" is offered anywhere;
  - Edge (browser blocks the tab): with the blocking option, a link "Open webmail" appears and opens the tab when tapped.
- [ ] T091 [P] [US6] Write `tests/unit/features/acting/webmail-opener.spec.ts` and `tests/unit/features/acting/OpenWebmailAsAction.spec.ts`: the request comes before `window.open`; `opener` is cleared on the returned window; a `null` window shows the link with `rel="noopener noreferrer"`; every refusal of research R9 maps to its message and calls no `window.open`; nothing rendered when `canOpenWebmailAs` is false (including `groupwareEnabled: false`).
- [ ] T092 [P] [US6] Add a case tagged `@webmail` to `tests/smoke/acting.smoke.spec.ts`: with `SMOKE_WEBMAIL_ON_BEHALF=1`, as `admin`, "Open webmail as" `alice@example.org` opens the webmail in a new tab showing her mailbox; skipped otherwise.

### Implementation for User Story 6

- [ ] T093 [US6] Implement `src/features/acting/webmail-opener.ts`, `createWebmailSignInOnBehalf` in `src/features/acting/api.ts`, and `src/features/acting/components/OpenWebmailAsAction.vue`, exported from `src/features/acting/index.ts`, so that T091 passes.
- [ ] T094 [US6] Add `OpenWebmailAsAction` next to `SignInAsAction` in UI 003's `src/features/mailboxes/components/MailboxActionsMenu.vue` and `src/features/mailboxes/pages/MailboxDetailPage.vue`, passing `groupwareEnabled` from UI 003's mailbox capabilities query; make UI 005's Webmail action on the mailbox home (in `src/features/account/`, the component UI 005's tasks name) unavailable while acting with `ActingUnavailableNotice` (FR-057).
- [ ] T095 [US6] Translations for US6: first add `user.open_webmail_sso` to `tests/unit/i18n/legacy-keys-007.spec.ts` (must fail); then add the `webmailOnBehalf.*` messages (action, blocked-tab link, the three `notEligible` reasons) and `problem.webmail-on-behalf-disabled` to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` and the `user.open_webmail_sso` mapping to `src/i18n/legacy-map.json`, and confirm `problem.groupware-disabled` exists. Run `npm run i18n:import`; the test and `npm run i18n:check` must pass.

**Checkpoint**: US1 to US6 work on their own.

---

## Phase 9: User Story 7 - Trace account changes and impersonations (Priority: P3)

**Goal**: "View history" on both detail screens, and the impersonated account in audit records and
as an audit log filter.

**Independent Test**: Follow "View history" from an administrator and a domain administrator, filter
by impersonated account, and check that records written while acting show both accounts.

**Depends on**: US1 and US4 (the detail screens); the audit log part depends only on Foundational.

### Tests for User Story 7 (write first; must fail)

- [ ] T096 [US7] Extend `tests/mocks/handlers/audit.ts` with `impersonatedAccount` in records and as a filter (exact match after lower-casing, including impersonation starts and ends), and add the scenario `audit-impersonation` (records of the 12 event types of API 007, records written while `admin` acted as `bob@a.example` and as `reseller`, and `ssoToken` sign-ins) to `tests/mocks/scenarios/acting.ts`.
- [ ] T097 [P] [US7] Write `tests/e2e/audit-log/impersonation.spec.ts`:
  - US7-AS1 and FR-071: "View history" on an administrator's and on a domain administrator's detail opens the audit log with `targetType` and `targetId` in the address and the request;
  - US7-AS2: records written while acting show the impersonator as the actor and the impersonated account, marked as done while acting, in text;
  - US7-AS3: the impersonated-account filter `bob@a.example` leaves only those records, appears as a removable chip, is kept in the address and survives a reload;
  - every event type of API 007 and the `ssoToken` method have translated labels; passwords appear only as "changed".
- [ ] T098 [P] [US7] Write `tests/unit/features/audit-log/impersonation.spec.ts`: `impersonated` mapped to `impersonatedAccount` (≤ 255 characters), the chip, `AuditEventItem.vue` rendering the actor and "while acting as {username} ({role})", and labels for the 12 event types, the targets `admin`, `domainAdmin`, `ssoToken` and `impersonation`, and `ssoToken`.
- [ ] T099 [P] [US7] Add a case to `tests/smoke/acting.smoke.spec.ts`: after acting as `alice@example.org`, the audit log filtered by impersonated account `alice@example.org` lists the run's impersonation start and end.

### Implementation for User Story 7

- [ ] T100 [US7] Extend UI 001's audit log: `impersonated` in `src/features/audit-log/list-state.ts`, the filter field in `src/features/audit-log/components/AuditFilters.vue`, the chip in `src/features/audit-log/components/ActiveFilterChips.vue`, the marker in `src/features/audit-log/components/AuditEventItem.vue`, and the labels in `src/features/audit-log/labels.ts`, so that T098 passes.
- [ ] T101 [US7] Add UI 002's `HistoryLink` (`targetType` `admin` or `domainAdmin`, `targetId` the username) to `src/features/administrators/pages/AdminDetailPage.vue` and `src/features/administrators/pages/DomainAdminDetailPage.vue`.
- [ ] T102 [US7] Translations for US7: add the `auditLog.event.<type>` labels of the 12 API 007 event types, `auditLog.target.<type>` for the four targets, `auditLog.authMethod.ssoToken`, `auditLog.filters.impersonated` and `auditLog.impersonation.marker` to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. `npm run i18n:check` must pass.

**Checkpoint**: All user stories work on their own.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story verification, budgets, translations, parity notes and validation.

- [ ] T103 [P] Write and pass `tests/e2e/administrators/reflow-and-keyboard.spec.ts`: every screen and dialog of this feature (both lists, both forms, both detail screens, the picker, the confirmations, the bulk summary, the one-time link dialog, the landing, the banner) has no horizontal scroll at 320 px and at the equivalent of 400 % zoom, never hides the focused element behind the sticky banner and header (WCAG 2.4.11), and runs no transition under `prefers-reduced-motion: reduce`; and the main path of each of US1 to US6 completes with the keyboard alone with visible focus (SC-006).
- [ ] T104 [P] Extend UI 001's `tests/e2e/shell/storage-and-secrets.spec.ts` with the flows of this feature (creating an account with a generated password, acting and returning, the landing, the one-time link): `localStorage` and `sessionStorage` hold only the keys of UI 001 data-model §4; no value, URL in history or `history.state` contains a password, a sign-in token, a one-time link or an acting origin path.
- [ ] T105 Run `npm run build && npm run budget:check && npm run lhci` (`scripts/check-bundle-budget.mjs`, `lighthouserc.cjs`). The initial JavaScript stays at most 204,800 bytes gzipped (the entry chunk grows only by the banner, the shell notice and the session modules), and Lighthouse performance and accessibility stay at least 0.9.
- [ ] T106 [P] Run `npm run i18n:check`, remove the unused keys it reports from `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, confirm that `tests/unit/i18n/legacy-keys-007.spec.ts` lists all 61 legacy keys of the spec (SC-007), and list the new cs-cz and sk-sk strings for the owner's review (UI 001 plan, owner question 4).
- [ ] T107 [P] Add the plan's two parity notes to the "Legacy Parity" table in `specs/007-administrators-domain-admins/spec.md`: bulk progress is a busy state because results arrive in one response; after a reload while acting, "Return" opens the own home screen.
- [ ] T108 [P] Hand API gap G1 to the owner for mailcow-rest-v2, using the proposal in `specs/007-administrators-domain-admins/plan.md` ("API dependency and gaps": a non-consuming token read answering the username or the generic `sign-in-failed`, counted towards the sign-in throttle). When a later contract offers it, a follow-up bump adds the link's account to the landing's question in `src/features/auth/pages/SsoTokenLandingPage.vue` (FR-060).
- [ ] T109 Run `quickstart.md` Part B on a mid-range Android phone and an iPhone with the production build served by `npm run preview:mock` on the local network. Record the SC-001, SC-002, SC-009 and SC-010 timings and a VoiceOver and TalkBack pass of US1, US2 and US5 (SC-006) in a "Validation log" section appended to `specs/007-administrators-domain-admins/quickstart.md`.
- [ ] T110 Run `quickstart.md` Part C (`scripts/smoke/stack-up.sh`, `npm run test:smoke`, `scripts/smoke/stack-down.sh`) once API 007 runs in the mailcow-rest-v2 dev stack, including the `@webmail` case when the stack enables `ALLOW_ADMIN_EMAIL_LOGIN`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** depends on UI 001 to 006 being implemented. T002 needs T001; T004 needs T003.
- **Foundational (Phase 2)** depends on Setup and **blocks every user story**. Within it: T006 and
  the tests T007–T012 in parallel; then T013 → T014 → (T015, T016, T017 in any order); T018 after
  T013; T019 last.
- **User stories (Phases 3–9)** depend on Foundational and on each other as the table shows.
- **Polish (Phase 10)** depends on every story it verifies.

### User Story Dependencies

| Story | Priority | Depends on | Why |
|---|---|---|---|
| US1 | P1 | Foundational; UI 002 (bulk, sections, typed confirmation, domain route), UI 003 (password field) | MVP: creates the feature, its shared components and the domain administrator screens |
| US2 | P1 | US1 (T034, T040); UI 003 (mailbox entry points); UI 001 and UI 005 (credential screens) | The entry points live in US1's actions menu and detail page and in UI 003's screens |
| US3 | P2 | US1 (T036, T040) | Mounts `PermissionsSection` on the editor and the detail page |
| US4 | P2 | US1 (T033, T034, T037, T040) | Reuses the account components, the password field and the sections; T076's self-rename uses the Foundational switch |
| US5 | P2 | Foundational for the landing; US1 (T040) for the link dialog; UI 005 (`OneTimeSecretDialog`) | The landing is independent; the link lives on the detail page |
| US6 | P3 | US2 (T053, T057); UI 003 (mailbox capabilities); UI 005 (Webmail action) | The action sits next to "Sign in as" and needs the acting state |
| US7 | P3 | Foundational for the audit log; US1 and US4 (T040, T076) for History links; UI 002 (`HistoryLink`) | Links on both detail pages |

### Files edited by several stories

Edits to these files must be serialised, even when stories run in parallel:

- `src/features/administrators/pages/DomainAdminDetailPage.vue`: US1, US2, US3, US5, US7;
- `src/features/administrators/pages/AdminDetailPage.vue`: US4, US7;
- `src/features/administrators/api.ts`, `list-state.ts`, `bulk.ts` and `routes.ts`: US1, US4, US5;
- `src/features/administrators/components/AccountActionsMenu.vue`: US1, US2, US4;
- `src/features/mailboxes/components/MailboxActionsMenu.vue` and `src/features/mailboxes/pages/MailboxDetailPage.vue`: US2, US6;
- `src/features/acting/api.ts` and `src/features/acting/index.ts`: US2, US6;
- `src/features/account/` screens: US2, US6;
- `src/app/layouts/ShellLayout.vue` and `AuthLayout.vue`: Foundational, US2;
- `tests/mocks/handlers/{index,admins,impersonation}.ts`: US1, US2, US4, US5, US6;
- `tests/mocks/scenarios/{administrators,acting}.ts`: US1, US2, US3, US4, US6, US7;
- `tests/smoke/{administrators,acting}.smoke.spec.ts`: US1, US2, US3, US6, US7;
- `tests/unit/features/administrators/{list-state,bulk,account-components}.spec.ts`: US1, US4;
- `tests/unit/i18n/legacy-keys-007.spec.ts`, `src/i18n/messages/*.json` and `src/i18n/legacy-map.json`: every story.

### Within Each User Story

- First the mock handlers, scenarios and fixtures; then end-to-end, unit and smoke tests, which must
  fail; then the implementation (logic → components → pages → routes); then the messages in all
  three locales, each story's legacy keys added to the legacy-key test first.

### Parallel Opportunities

- Setup: T003 and T005 in parallel with T002.
- Foundational: T006–T012 in parallel; T015, T016 and T017 in parallel after T014.
- US1: T021–T032 in parallel after T020; T034, T035 and T036 in parallel after T033.
- After US1: US3, US4 and US5 can be staffed in parallel with US2, observing the shared files above;
  US6 follows US2; US7 follows US4.

---

## Parallel Example: User Story 1

```bash
# After T020 (handlers and scenarios), write all US1 tests together:
Task: "T021 tests/e2e/administrators/domain-admins-list.spec.ts"
Task: "T022 tests/e2e/administrators/domain-admin-create.spec.ts"
Task: "T023 tests/e2e/administrators/domain-admin-detail.spec.ts"
Task: "T024 tests/e2e/administrators/domain-admin-remove-and-bulk.spec.ts"
Task: "T025–T031 tests/unit/features/administrators/*.spec.ts"
Task: "T032 tests/smoke/administrators.smoke.spec.ts"

# After T033 (logic), build the components together:
Task: "T034 account components"
Task: "T035 DomainPicker, DomainPickerDialog, DomainAssignmentList"
Task: "T036 PermissionsEditor.vue"
# T038–T041 then build pages and routes in order.
```

## Parallel Example: User Story 2

```bash
# After T043 (impersonation mock, tab fixture, scenarios):
Task: "T044 tests/e2e/acting/acting-mailbox-user.spec.ts"
Task: "T045 tests/e2e/acting/acting-domain-admin.spec.ts"
Task: "T046 tests/e2e/acting/acting-ended.spec.ts"
Task: "T047 tests/e2e/acting/acting-tabs.spec.ts"
Task: "T048–T051 unit tests"     Task: "T052 tests/smoke/acting.smoke.spec.ts"
# After T053:
Task: "T054 SignInAsAction.vue + ActingUnavailableNotice.vue"
Task: "T055 ActingBanner.vue + layouts + title prefix"
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
6. Polish: reflow and keyboard, storage audit, budgets, translations, parity notes, gap report,
   device validation and the smoke run.

### Parallel Team Strategy

After Foundational:
- Developer A: US1, then US3.
- Developer B: US2 (after US1's T034 and T040), then US6.
- Developer C: US5's landing (T079–T086), then US4, then US7.

Edits to the shared files listed under "Files edited by several stories" run one at a time.

---

## Notes

- [P] tasks touch different files and have no dependency on an incomplete task.
- [USn] labels map tasks to the spec's user stories, and test titles carry the spec IDs for
  traceability.
- Verify that each test fails before implementing (constitution VI).
- Commit after each task or logical group, directly to `main`, with short imperative subjects.
- Never add a hand-written API type, a `v-html` outside `SanitizedHtml.vue`, an inline style or
  script, a storage key outside UI 001 data-model §4, a cached token or link, or a request resent
  under another identity.
