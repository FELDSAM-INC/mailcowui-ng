---
description: "Task list for UI feature 008: sync jobs"
---

# Tasks: Sync Jobs

**Input**: Design documents from `specs/008-sync-jobs/`:
- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/README.md](./contracts/README.md)
- [quickstart.md](./quickstart.md)

**Prerequisites**: UI 001 to UI 007 implemented (plan, "Dependencies on earlier features"; checked
by T004) and API 008's contract merged (it is). The API implementation is not needed: everything
but the smoke tests runs against the contract-validated mock.

**Tests**: Mandatory (constitution VI, test-first). In every phase, tests are written first and must
fail before the implementation tasks that follow them. Every end-to-end spec:
- runs on the `mobile-chromium` (360 px), `desktop-chromium` and `mobile-webkit` projects (UI 001
  research R24), except `log-performance.spec.ts`, which is Chromium-only;
- starts from an active-session scenario of `tests/mocks/scenarios/sync-jobs.ts`
  ([data-model §8](./data-model.md#8-mock-scenarios-testsmocksscenariossync-jobsts));
- calls `expectAccessible` (axe, WCAG 2.2 AA, both themes) on every screen, dialog and state it
  reaches, `expectNoHorizontalScroll` at 360 and 320 px on the mobile projects, and
  `expectTouchTargets`;
- fails on any CSP violation or mock contract violation (UI 001 T029 fixtures);
- names its spec reference in the test title (`US1-AS5 …`, `FR-014 …`, `Edge: …`).

**Organization**: Tasks are grouped by user story (spec priorities P1, then P2), so that each story
can be implemented and tested once the foundation is in place.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1 to US6)
- Paths are relative to the repository root `mailcowui-ng/`

---

## Phase 1: Setup

**Purpose**: Pin the contract, extend the translation check, and verify the parts UI 008 builds on
(research R1, R2, R19).

- [X] T001 *(done: pinned at mailcow-rest-v2 `fc79902` (API 008 implemented); two compatible differences from the baseline, recorded in contracts/README.md)* Pin the contract (research R1, [contracts/README.md](./contracts/README.md)). If `contract/VERSION.json` names a commit older than `32079252d55797d3da4e58ae661e9fb91c51c6f9`, run `MAILCOW_REST_V2_DIR=../mailcow-rest-v2 scripts/contract/bump.sh 32079252d55797d3da4e58ae661e9fb91c51c6f9` (or a later release tag that contains it); never move the pin backwards. Then confirm, in `contract/openapi.json`, that the operations `listSyncJobs`, `createSyncJob`, `getSyncJobsCapabilities`, `applySyncJobBulkAction`, `getSyncJob`, `updateSyncJob`, `deleteSyncJob`, `getSyncJobLog` and `rescheduleSyncJob`, their parameters, schemas and documented statuses, are identical to the baseline's, and that `listMailboxes`, `listDomains` and `listAuditEvents` with `targetType`/`targetId` exist. A difference stops the feature until the plan is updated (FR-053). Record the pinned commit in the "Pinned contract" table of `specs/008-sync-jobs/contracts/README.md`. Run `npm run contract:check`, `npm run typecheck` and `npm run test:unit`.
- [X] T002 [P] Write `tests/unit/scripts/i18n-check-008.spec.ts` (research R19): against fixture message sets, the check must require a key for every value of `syncJobEncryptionValues` (`ssl`, `starttls`, `plain`) under `enums.syncJobEncryption`, `syncJobLastResultValues` (`succeeded`, `failed`, `unknown`) under `enums.syncJobLastResult` and `syncJobBulkActionValues` (`activate`, `deactivate`, `reschedule`, `delete`) under `enums.syncJobBulkAction`, and the format key `validation.format.hostName`. The test must fail.
- [X] T003 *(done: `REQUIRED_FORMATS` in `scripts/i18n/lib.mjs` carries `hostName`)* Add the three enumerations to `ENUM_NAMESPACES` in `scripts/i18n/lib.mjs` (confirm the generated array names in `src/api/generated/schema.ts`) and `hostName` to the checked `validation.format.*` keys, so that T002 passes. `npm run i18n:check` now fails until the messages of T040 and T048 exist; that is expected.
- [X] T004 *(done. Present: every UI 001 and UI 002 part. Missing, with the decision taken: `NotFoundState` (UI 003/004) → UI 001's `NotFoundPage` with `back-to`, as UI 002's detail pages use it; `FilterPanel` (UI 006) → filters stay in the feature, as UI 002 and UI 003 keep theirs (UI 006 R12 creates the shared panel at its third use); `neutralise()` (UI 006) → created by UI 008 at `src/shared/security/plain-text.ts` with UI 006 data-model §2's signature, as the first feature implemented that needs it (conventions "Ownership"); `requiredFlags` → read from `ApiProblem.extensions`; `MailboxSearchPicker`, `DomainPicker`, the shared `ActiveFilterChips`, the mailbox mocks and `MailboxDetailPage` come with UI 003, built in parallel: everything that needs them waits for UI 003 on `main` (no copy). Optional parts: the `permission-flag-required` reaction and the "view" parameter of `useListState` are missing (T005/T006, T009/T010))* Verify the prerequisites of research R2 and stop if any is missing (report it to its owning feature; do not build a substitute):
  - UI 001: the `syncJobs` catalogue entry in `src/app/navigation/catalogue.ts` with `access` `{ admin: true, domainAdmin: { anyFlag: ['syncjobs'] }, mailboxUser: { anyFlag: ['syncjobs'] } }`; `src/app/states/{NoAccessState,NotFoundPage}.vue`; `src/shared/composables/{useListState,useConfirm,useVersionedSave,useProblemForm,useAnnouncer,useMediaQuery}.ts`; `src/shared/components/{ListState,PaginationBar,ConfirmDialog,FormField,ErrorSummary,ProblemMessage,DateTime,RelativeTime,PageHeader,LiveAnnouncer}.vue`; `src/shared/platform/clipboard.ts`; `tests/mocks/server.ts` with `PATCH /__mock/scenarios/:id`; `tests/e2e/fixtures/test.ts`;
  - UI 002: `src/shared/composables/useBulkSelection.ts` (with the `limit` option of UI 004 D2), `src/shared/components/{BulkActionBar,BulkResultSummary,EditableSection,HistoryLink}.vue`, `requireTyped` and list content in `ConfirmDialog.vue`, `changedSince()` in `useVersionedSave.ts`, the leave guard (`src/shared/composables/useLeaveGuard.ts` or `useUnsavedChangesGuard.ts`), `targetType`/`targetId` in `src/features/audit-log/list-state.ts`, the enumeration scope manifest (`src/i18n/coverage.json` or `enum-scope.json`), `tests/mocks/handlers/domains.ts` and `tests/mocks/factories/domain.ts`;
  - UI 003: `tests/mocks/handlers/mailboxes.ts` (`listMailboxes` with `q` and `sort`), `tests/mocks/factories/mailbox.ts`, mailbox and domain state in `tests/mocks/scenarios/state.ts`, `src/shared/components/NotFoundState.vue`, and `src/features/mailboxes/pages/MailboxDetailPage.vue` with its header page actions (UI 003 data-model §8);
  - UI 004 and UI 006: `src/shared/components/{DomainPicker,SearchField,FilterPanel,ActiveFilterChips}.vue`, `requiredFlags` readable on `ApiProblem` in `src/api/problem.ts`, and `neutralise()` in `src/shared/security/plain-text.ts`.

  Note which of these three optional parts exist, for T005 to T010: the session reaction to `permission-flag-required` in `src/api/query/client.ts` (planned by UI 004 D15 and UI 005); UI 006's `MailboxSearchPicker.vue` and where it lives; a non-filter ("view") parameter kind in `useListState`.

**Checkpoint**: The contract is pinned and verified, every prerequisite exists, and the translation
check knows the sync-job enumerations.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The optional shared parts, the sync-job mock API, the query layer and the pure logic
every story uses: presentation, form model and field messages.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Legacy form map (constitution IV 1.3.0)

- [X] T004a *(done: plan.md "Legacy form map", parts 1 to 3; the 1:1 rule replaces the sectioned form, the warnings and the details-page actions, listed as deviations 4 to 9)* Write the legacy form map for this feature's screens (screen → legacy template → field → legacy key, including messages) in `plan.md`, and use only those keys plus the minimal new strings in the implementation.
  Follow `docs/conventions.md` "Translations and forms" and the templates in plan.md "Translations and forms (constitution IV 1.3.0)"; list any deviation under "Deviations needing a decision". Every later screen task depends on it.

### Shared parts (T005/T006 and T009/T010 only when T004 found the part missing)

- [X] T005 [P] Only if missing: add to `tests/unit/api/query-client.spec.ts` that a `403` problem of type `/api/v2/problems/permission-flag-required` invalidates the identity query, exactly as `forbidden` does (UI 001 research R8). The test must fail.
- [X] T006 Only if missing: implement that reaction in the `QueryCache` and `MutationCache` `onError` hooks of `src/api/query/client.ts`, so that T005 passes.
- [ ] T007 [P] Write `tests/unit/shared/components/MailboxSearchPicker.spec.ts` (research R9): a Reka `Combobox` without `ComboboxViewport` over `listMailboxes` (`q`, `sort=address`, 25 per page), a 300 ms debounce, `useInfiniteQuery` "load more", empty, error and retry states, options with the address and, when set, the display name, a free-text mode that accepts a typed address, and an empty-result slot. Keep UI 006's existing tests of the picker as they are. The new cases must fail.
- [ ] T008 Promote UI 006's `MailboxSearchPicker.vue` (from its rate-limits feature, the path T004 found) to `src/shared/components/MailboxSearchPicker.vue`, its second use (constitution VIII), add the free-text mode and the empty-result slot, and update UI 006's imports so that its tests stay green; if it does not exist, create it there. T007 must pass.
- [X] T009 [P] Only if missing: add to `tests/unit/shared/composables/useListState.spec.ts` a parameter kind "view" that is parsed, validated and kept in the address but never resets `page` and never calls `onReset` when it changes (needed for `log`, data-model §5). The test must fail.
- [X] T010 *(done: `ListSchema.views` with `useListState().views` and `setView(key, value, { replace })`)* Only if missing: implement the "view" parameter kind in `src/shared/composables/useListState.ts`, so that T009 passes.

### Mock API (test infrastructure)

- [X] T011 [P] Create `tests/mocks/factories/sync-job.ts`: `syncJob(overrides)` building a contract-valid `SyncJob` (`id`, `mailbox`, `remoteHost`, `remotePort`, `encryption`, `authMechanism: 'plain'`, `remoteUser`, `remotePasswordSet`, every option, `active`, `runStatus` `{ lastRunAt, lastResult, exitStatus, running, logAvailable }`, `createdAt`, `modifiedAt`, a quoted strong `etag` derived from the configuration only) plus a stored `remotePassword` and `log` kept beside it in scenario state; `syncJobCapabilities(overrides)` with today's defaults (`exclude: '(?i)spam|(?i)junk'`, interval 20, timeouts 600, `encryptions: ['ssl','starttls','plain']`), limits (`remotePort` 1–65535, `intervalMinutes` 1–43800, `maxAgeDays` 0–32000, `maxBytesPerSecond` 0–125000000, both timeouts 1–32000, lengths 255, 255, 255, 255, 500, 512), `bulkLimit: 100`, `pageSize { default: 25, maximum: 1000 }` and `customParameters { allowed: true, restrictedToAdministrators: false, allowedOptions: ['maxsize','minage','nofoldersizesatend','useheader'] }`; `bigLog(megabytes)` returning deterministic imapsync-like lines.
- [X] T012 *(done: the jobs live in `state.syncJobs` (`SyncJobState`); the target mailboxes, the resource and the alias come from the scenario domains, as UI 002's directory lists read them, until UI 003's mailbox state replaces them)* Create `tests/mocks/scenarios/sync-jobs.ts` with the eleven scenarios of data-model §8, seeding their domains and mailboxes (and the resource of `sync-jobs-admin`) with `tests/mocks/factories/{domain,mailbox}.ts` in the state UI 002 and UI 003 defined, and register the module in `tests/mocks/scenarios/index.ts`. Add the `syncJobs` runtime changes of data-model §8 ("Runtime changes") to the scenario patch handling of `PATCH /__mock/scenarios/:id`. Depends on T011.
- [X] T013 Write `tests/unit/mocks/sync-jobs-handlers.spec.ts` against `msw/node` and the validator (UI 001 research R22). It covers:
  - scope and flags: `403 permission-flag-required` with `requiredFlags: ['syncjobs']` before any lookup; out-of-scope jobs and target mailboxes answer `404`;
  - list: `q`, the filters `mailbox`, `domain`, `active`, `running`, `lastResult`, every `SyncJobSort` value with ties by `id`, paging and `ListMeta`;
  - create and update: each rule code of research R20 with its parameters (including `notEligible` with `kind: 'resource'` for the scenario's resource), `409 sync-job-exists` with `syncJobId` for a case-insensitive duplicate, `412` on a stale `If-Match`, `Location` and `ETag` headers, a new `etag` only on configuration changes, an empty `remotePassword` keeping the stored one, `immutable` on a different `mailbox`;
  - reschedule clears `lastRunAt` and `lastResult` and keeps `etag`; delete answers `204`;
  - bulk: results in request order, `outdated` on a version mismatch except for `reschedule`, `notFound`, a duplicate processed once, `422 tooMany` above `bulkLimit`, `failed` with a problem for `failBulkItems`;
  - log and capabilities from the scenario, and each runtime change of data-model §8;
  - zero contract violations in every case, and the password never in any response.

  The test must fail. Depends on T012.
- [X] T014 Implement `tests/mocks/handlers/sync-jobs.ts` with `openapi-msw` for the nine operations of [contracts/README.md](./contracts/README.md), as research R20 describes, and register it in `tests/mocks/handlers/index.ts`, so that T013 passes. The `invalidRegex` stand-in refuses patterns with unbalanced `()` or `[]`; `invalidFormat` `hostName` refuses IPv6 literals and names that are not letter/digit labels with inner hyphens.

### Tests for the core (write first; must fail)

- [X] T015 [P] Write `tests/unit/features/sync-jobs/api.spec.ts` (data-model §3): the query keys and their `staleTime`/`gcTime`; capabilities fetched only when a consumer enables them; the detail's `initialData` from a cached list entry with `initialDataUpdatedAt`; every row of the invalidation table, including `['audit-events']` after each mutation (create writes the detail and invalidates lists; update and reschedule replace cached list entries; delete removes detail and log; bulk invalidates lists and removes deleted details; `404` removes the detail); `If-Match` carries the quoted `etag`; `rescheduleSyncJob` sends no `If-Match`; the patch is sent as `application/merge-patch+json`; after create and update no cache entry contains the submitted `remotePassword`.
- [X] T016 *(done with the classic tables: "Waiting" and "Check log" as legacy shows them (plan deviations 1, 2))* [P] Write `tests/unit/features/sync-jobs/presentation.spec.ts`: `jobLabel` (`user@host:port`); every row of the state, result and last-run tables of data-model §2, including an inactive running job (both badges), each of the six known failure codes, an unknown code, `exitStatus: null` with `failed`, `succeeded` with an unknown code ("Success"), and `lastRunAt: null` with and without `logAvailable`.
- [X] T017 *(done under the 1:1 rule: one form in the classic order instead of the section map and non-default counts (plan deviation 7))* [P] Write `tests/unit/features/sync-jobs/form-model.spec.ts` (data-model §2, §6): the section map with members, option names and advanced flags; initial create values from `capabilities.defaults`, `?mailbox=` preselection, the mailbox user's own address; the port rule (993/143, follows encryption until typed into, also within a Source section edit); non-default counts per section against `capabilities.defaults`; the create body (all members, integers parsed, no `mailbox` for mailbox users, no `customParameters` when not allowed); the section patch (only changed members, `remotePassword` only when not empty, never `mailbox`, never `customParameters` when not allowed, empty patch → nothing to send); client checks with limits taken from a capabilities object whose limits differ from today's (proving nothing is hard-coded, FR-055).
- [X] T018 [P] Write `tests/unit/features/sync-jobs/field-messages.spec.ts`: each pair of research R13 maps to its `syncJobs.errors.*` key with parameters (`option`, `token`, `kind` translated), and any other code falls back to UI 001's `validation.<code>` and then `validation.invalid`.

### Core implementation

- [X] T019 Add the sync-job keys to `src/api/query/keys.ts` and implement `src/features/sync-jobs/api.ts`: `useSyncJobs(params)`, `useSyncJob(id)`, `useSyncJobLog(id, enabled)`, `useSyncJobCapabilities(enabled)`, and the mutations `createSyncJob`, `updateSyncJob` (through `useVersionedSave`), `rescheduleSyncJob`, `deleteSyncJob`, `applySyncJobBulkAction`, with the cache writes and invalidation of data-model §3. List parameter types alias the generated `operations['listSyncJobs']['parameters']['query']`. T015 must pass.
- [X] T020 [P] Implement `src/features/sync-jobs/presentation.ts`, so that T016 passes.
- [X] T021 *(done: `SyncJobFormValues` derived from the generated `SyncJobCreateRequest`)* [P] Implement `src/features/sync-jobs/form-model.ts` (`SyncJobFormValues` derived from the generated `SyncJobCreateRequest`, never restated), so that T017 passes.
- [X] T022 *(done: the generic `validation.*` path handles the rules without a sync-job message; the forms render through `useFieldMessages()`)* [P] Implement `src/features/sync-jobs/field-messages.ts`, so that T018 passes.

**Checkpoint**: The mock serves every sync-job operation with zero contract violations; the query
layer, the shared mailbox picker and the pure logic are tested. Stories can start.

---

## Phase 3: User Story 1 - See sync jobs and their state (Priority: P1) 🎯 MVP

**Goal**: Every permitted role sees the jobs of its scope as cards or a table with state, last run
and last result; searches, filters, sorts and pages them in the address; opens a job's details with
every setting and, for administrators, its History; the list refreshes itself while a job runs; UI
003's mailbox detail links to the mailbox's jobs.

**Independent Test**: With `sync-jobs-admin`, `sync-jobs-domain-admin`, `sync-jobs-user` and the
no-flag scenarios, open the list and the details on 360 px and desktop and compare every value with
the mock data (spec US1).

### Tests for User Story 1 (write first; must fail)

- [X] T023 [P] [US1] Write `tests/e2e/sync-jobs/list.spec.ts`:
  - US1-AS1 and FR-005: at 360 px every job is a card with a heading (the job label), the target mailbox, state badges, last run, last result and interval, with no horizontal scroll at 360 and 320 px;
  - US1-AS2 and FR-011: on desktop a table with the same columns, sortable headers with `aria-sort`; newest job first by default; on phones a sort select with the same options;
  - US1-AS5 and FR-006, FR-007: each of the six recognised failure codes reads its legacy text in en-gb and, after switching to Čeština, in cs-cz, with a cross icon and the hidden "Failed:" prefix; an unknown code and `null` read "Check log"; a success reads "Success" with a check icon (a success with an unrecognised code reads "Check log", as in the classic interface, until the plan's deviation 2 is decided); an inactive running job shows both badges;
  - US1-AS6: a never-run job and a rescheduled job read "Waiting" (`mailbox.waiting`) with no result, as in the classic interface, until the plan's deviation 1 is decided ("Never" and "Cleared, runs on the next cycle" if approved);
  - US1-AS7, FR-013 and FR-047: the loading state; `sync-jobs-empty` shows the explanation of sync jobs; a search with no match offers "Clear filters"; a documented `500` (failure injection) and a `route.abort()` network failure show the error state with a working retry and the request ID for the `500`;
  - US1-AS8 and FR-009: search by part of a host or address, filters by mailbox (`MailboxSearchPicker`, free-text), domain (`DomainPicker`), active, running and last result (succeeded, failed, no result) in the filter panel with removable chips; the match count is shown and announced in the polite live region;
  - FR-010: reload, a copied address and Back restore search, filters, sort, page and page size; nothing is written to storage;
  - FR-012: page sizes 25, 50 and 100, the total, and touch-friendly paging at 360 px;
  - FR-051: last-run times are relative with the absolute time available, in the active locale; numbers use locale grouping;
  - FR-008, Edge: 255-character hosts, usernames and patterns wrap with the full value readable, with no horizontal scroll;
  - FR-014: the manual "Refresh" refetches.
- [X] T024 *(done: the seeded user without the flag is the scenario `sync-jobs-user-no-flag`)* [P] [US1] Write `tests/e2e/sync-jobs/scope-access.spec.ts`:
  - US1-AS3 and FR-002: `sync-jobs-domain-admin` sees only `example.org` jobs, exactly the jobs the mock returns for that scope;
  - US1-AS4: `sync-jobs-user` sees only alice's jobs, with no target mailbox column, filter or sort;
  - FR-001 and FR-003, Edge: `sync-jobs-domain-admin-no-flag` and `sync-jobs-user-no-flag` have no "Sync jobs" entry, and opening `/ng/sync-jobs` and `/ng/sync-jobs/1` shows the "not permitted" state with no sync-job request recorded by the mock;
  - Edge: revoking the flag at runtime, then refreshing the list, gets `403 permission-flag-required`; the "not permitted" state replaces the list and the navigation entry disappears;
  - FR-003: `/ng/sync-jobs/999999` (unknown) and carol's job for alice show "not found" with a link to the list; `/ng/sync-jobs/9999999999` shows "not found" without any request;
  - Edge: a job deleted at runtime while its details are open shows "This sync job no longer exists" on the next action and returns to the refreshed list;
  - Edge: a job whose target mailbox was renamed at runtime appears under the new address after "Refresh".
- [X] T025 *(done under the 1:1 rule: the edit page's fields in its order with its labels, booleans as legacy's ✓/✕; no collapsed sections (plan deviation 7))* [P] [US1] Write `tests/e2e/sync-jobs/detail.spec.ts`:
  - FR-015: the identifier, state, last run, last result, created and changed times, and all seven sections of FR-016 with every stored value; booleans read "On"/"Off" as text; each option shows its imapsync name;
  - FR-017: at 360 px "Duplicates and deletion", "Limits and timeouts" and "Expert options" start collapsed, each header stating how many values differ from the defaults; on desktop all are open; the triggers expose `aria-expanded`;
  - FR-020: the target mailbox is shown without an edit control;
  - FR-015: administrators get a History action opening `/ng/audit-log?targetType=syncJob&targetId=<id>`; domain administrators and mailbox users do not;
  - FR-029: no password value appears anywhere on the page; "A password is saved" is shown for `remotePasswordSet`.
- [X] T026 [P] [US1] Write `tests/e2e/sync-jobs/auto-refresh.spec.ts` with `page.clock` and `sync-jobs-running`:
  - FR-014: while a listed job runs, the list is refetched every 30 s; after the run is finished at runtime, the next refetch shows the result and refreshing stops;
  - with no running job, no refetch happens in 5 minutes;
  - while the page is hidden (visibility state overridden and `visibilitychange` dispatched) no refetch happens, and becoming visible refetches once;
  - "Pause automatic refresh" stops refetching and "Resume" restarts it at once (WCAG 2.2.2);
  - after 15 minutes without interaction (and, with a scenario idle timeout of 5 minutes, after 5 minutes) refreshing pauses with an announced notice and "Resume"; it does not resume by itself;
  - automatic refreshes add nothing to the live regions;
  - Edge: several running jobs keep one 30 s cycle.
- [X] T027 [P] [US1] Write `tests/e2e/sync-jobs/entry-points.spec.ts`:
  - FR-004: on UI 003's mailbox detail for `alice@example.org`, administrators and domain administrators with the flag see "Sync jobs" among the header page actions, which opens `/ng/sync-jobs?mailbox=alice%40example.org` with the mailbox filter applied;
  - a domain administrator without the flag sees no such link on the mailbox detail;
  - a mailbox user with the flag finds "Sync jobs" in the navigation.
- [X] T028 *(done: `useInactivity.spec.ts` lives in `tests/unit/shared/composables/`, as the composable is shared)* [P] [US1] Write `tests/unit/features/sync-jobs/list-state.spec.ts` (data-model §5: every parameter, defaults omitted, `yes`/`no` → booleans, `none` → `unknown`, role-dependent dropping of `mailbox`, `domain` and the `mailbox` sort, page reset and `onReset` on filter, sort, order and size changes, `log` as a view parameter), `tests/unit/features/sync-jobs/useInactivity.spec.ts` (passive listeners for `pointerdown`, `keydown`, `wheel`, `touchstart` and `scroll` on `window`, throttled to once per second, the limit `min(15 min, Session.idleTimeout)`, removal on unmount) and `tests/unit/features/sync-jobs/useRunningRefresh.spec.ts` (fake timers: the five conditions of research R7, the visibility refetch rule, the inactivity notice, and `refetchInterval` returning `false` whenever a condition fails).
- [X] T029 *(done in `list-components.spec.ts` and `MailboxSyncJobsLink.spec.ts`; no `FormSection` (plan deviation 7); the filters use the shared pickers and `ActiveFilterChips` of UI 003 and UI 004)* [P] [US1] Write the component tests in `tests/unit/features/sync-jobs/`:
  - `SyncJobCard.spec.ts`: heading with the label, state and result as text plus icon, the target mailbox hidden for mailbox users;
  - `SyncJobTable.spec.ts`: column headers, `aria-sort`, the target column hidden for mailbox users;
  - `SyncJobFilters.spec.ts`: filters per role in the shared `FilterPanel` with `ActiveFilterChips`, `MailboxSearchPicker` in free-text mode and `DomainPicker` for administrators and domain administrators only, native selects, the phone sort select;
  - `FormSection.spec.ts`: collapsed below `md` for advanced sections and open otherwise, the non-default count, opening itself when it holds an error, `aria-expanded`;
  - `SyncJobSectionValues.spec.ts`: values per section, "On"/"Off" text, "Not set", option names;
  - `MailboxSyncJobsLink.spec.ts`: rendered only when `canAccess('syncJobs')` holds, with the encoded `mailbox` parameter, and no request;
  - `AutoRefreshControl.spec.ts`: shown only while a listed job runs, pause and resume states, the inactivity notice.
- [ ] T030 [P] [US1] Create `tests/smoke/sync-jobs.smoke.spec.ts` with the list cases (research R21): alice (TOTP through UI 001's smoke fixtures) sees jobs #1 and #2 but not #3, and #2 reads "Wrong username or password"; bob has no entry and sees "not permitted" at `/ng/sync-jobs`; `reseller` sees only `example.org` jobs; `admin` opens alice's mailbox detail and follows "Sync jobs" to the filtered list.

### Implementation for User Story 1

- [X] T031 [US1] Implement `src/features/sync-jobs/list-state.ts` (the schema of data-model §5, mapped to `SyncJobListParams`), so that the list-state part of T028 passes.
- [X] T032 *(done in `src/shared/composables/useInactivity.ts` (orchestrator: UI 008 owns it and UI 011 reuses it))* [P] [US1] Implement `src/features/sync-jobs/composables/useInactivity.ts` (research R7, the listeners and limit of UI 011 R5), so that its part of T028 passes.
- [X] T033 [P] [US1] Implement `src/features/sync-jobs/components/SyncJobStateBadges.vue`, `SyncJobResult.vue` ("Check log" as text for now; US5 makes it a link) and `SyncJobLastRun.vue` on `presentation.ts`, `RelativeTime` and the UI 001 icons.
- [X] T034 [US1] Implement `src/features/sync-jobs/composables/useRunningRefresh.ts` (research R7: `refetchInterval` function, `refetchIntervalInBackground: false`, the visibility listener, the pause flag, the selection-mode input, `useInactivity`) and `src/features/sync-jobs/components/AutoRefreshControl.vue`, so that the rest of T028 passes. Depends on T032.
- [X] T035 *(done under the 1:1 rule: no `FormSection` (one form, plan deviation 7); `SyncJobValues.vue` shows the read mode)* [P] [US1] Implement `src/features/sync-jobs/components/FormSection.vue` (Reka `Collapsible`, initial state from `useMediaQuery('(min-width: 768px)')` and the section's advanced flag, non-default count from `form-model.ts`, open on error) and `SyncJobSectionValues.vue`.
- [X] T036 *(done: filters in the feature (UI 006 creates the shared panel); the row menu offers the classic Edit and Remove (plan deviation 5))* [US1] Implement `src/features/sync-jobs/components/SyncJobCard.vue` (below `md`), `SyncJobTable.vue` (from `md` up, on `src/shared/ui/table`, sortable headers with `aria-sort`), `SyncJobList.vue`, `SyncJobFilters.vue` (`SearchField`, `FilterPanel`, `ActiveFilterChips`, `MailboxSearchPicker` in free-text mode, `DomainPicker` with the domains source, native selects, the phone sort select) and `SyncJobRowActions.vue` (a Reka `DropdownMenu` named after the job label, with "Open" for now). Depends on T033. T029's card, table and filter tests must pass.
- [X] T037 *(done: in the header page actions of UI 003's `MailboxDetailPage.vue`)* [P] [US1] Implement `src/features/sync-jobs/components/MailboxSyncJobsLink.vue` (research R4), export it from `src/features/sync-jobs/index.ts`, and place it among the header page actions of UI 003's `src/features/mailboxes/pages/MailboxDetailPage.vue` (UI 003 data-model §8). The link component sends no request.
- [X] T038 *(done: the job page has the classic edit heading, History for administrators, the run status with the list's keys and one section; no Refresh or other actions (conventions "Detail pages", plan deviation 6))* [US1] Implement the pages in `src/features/sync-jobs/pages/`:
  - `SyncJobsPage.vue`: `useListState` with `list-state.ts`, `ListState` (loading, empty with the explanation, no match with "Clear filters", error with retry), `PaginationBar`, `SyncJobFilters`, the manual "Refresh", `AutoRefreshControl` with `useRunningRefresh`, and the polite announcement of the match count after user-driven changes;
  - `SyncJobDetailPage.vue`: the header (label, state, last run, result, created and changed times, a "Refresh" action, `HistoryLink` with `targetType=syncJob` for administrators), the seven sections in read mode through `FormSection` and `SyncJobSectionValues` (capabilities enabled for the defaults), `NotFoundState` with a link to the list, and the identifier range check of data-model §5.

  Depends on T031 and T033 to T036.
- [X] T039 [US1] Implement `src/features/sync-jobs/routes.ts` (`sync-jobs` and `sync-job-detail` of data-model §5, lazy), complete `src/features/sync-jobs/index.ts`, register the routes in `src/app/router/routes.ts`, and set the `syncJobs` entry to `available` in `src/app/navigation/catalogue.ts`, so that no navigation entry leads to "not found" (UI 001 SC-007). T023 to T027 must pass.
- [X] T040 *(done: legacy keys by their keys; new strings under `syncJobs.*`, the sync-job enumerations, `validation.format.hostName` and the audit labels; `LEGACY_TEXTS` maps `enums.syncJobLastResult.succeeded`, `enums.syncJobBulkAction.*`, `problem.sync-job-exists` (with `LEGACY_ARGS`) and the owner's `required`)* [US1] Add the `syncJobs.*` new strings of this story that the legacy form map (T004a) lists (filters, sorts, empty and error texts, refresh controls, the inactivity notice, the hard-coded legacy "Server", "Log" and "ID") and every `enums.syncJobLastResult.*` key to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Use the legacy keys of research R19 verbatim (`mailbox.sync_jobs`, `user.sync_jobs`, `user.create_syncjob`, `mailbox.owner`, `mailbox.last_run`, `mailbox.syncjob_last_run_result`, `mailbox.active`, `mailbox.status`, `mailbox.running`, `mailbox.waiting`, `mailbox.inactive`, `mailbox.mins_interval`, `mailbox.excludes`, `mailbox.action`, the mailbox user's `user.*` columns, `mailbox.syncjob_EX_OK`, the six `mailbox.syncjob_EXIT_*`, `mailbox.syncjob_check_log`, `mailbox.open_logs`, `admin.refresh`, and the edit page's field labels shown in read mode, including `edit.subfolder2`, `edit.maxage` and `edit.maxbytespersecond` through `SanitizedHtml.vue`). Add the audit log labels of `syncJobCreation`, `syncJobUpdate`, `syncJobReschedule`, `syncJobDeletion`, the target type `syncJob` and the failure reasons `permissionDenied` and `notFound` (unless listed), in `src/features/audit-log/labels.ts` if labels are mapped there and in the messages, and append these values to the enumeration scope manifest (`src/i18n/coverage.json` or its implemented name). The audit labels are new strings (the audit log has no legacy counterpart). `npm run i18n:check` must pass for this story's keys (FR-052).

**Checkpoint**: US1 works on its own: the list, the details in read mode, History, the automatic
refresh and the mailbox entry point.

---

## Phase 4: User Story 2 - Create a sync job (Priority: P1)

**Goal**: A sectioned create form with capabilities defaults, the port rule, the role-dependent
target, the protected remote password, warnings, client checks and field-level server errors.

**Independent Test**: As each role, create a job with only the required fields and another with
every option changed, on both viewports; compare the requests with the input and the capabilities
defaults; submit invalid values and see each error on its field (spec US2).

### Tests for User Story 2 (write first; must fail)

- [X] T041 *(done under the 1:1 rule: the classic add form in its order; no collapsed sections, warnings or "Simulate" explanation (plan deviations 7, 8); the empty picker shows legacy's "No matching records found")* [P] [US2] Write `tests/e2e/sync-jobs/create.spec.ts`:
  - FR-048: "Add sync job" is in the list header, reachable without scrolling at 360 px, and in the empty state;
  - US2-AS1 and FR-016, FR-017: at 360 px Target mailbox, Source, Schedule and Folders are open and the three advanced sections collapsed with their summaries; on desktop all are open;
  - US2-AS2 and FR-018, FR-055: every field holds the capabilities default; a minimal submission sends those defaults; with a scenario whose capabilities defaults and limits differ from today's, the form and the help texts follow the scenario;
  - FR-019: the port starts at 993, becomes 143 with STARTTLS and plain, and stops following once typed into;
  - US2-AS3: `sync-jobs-user` sees its own mailbox as the target, no picker, and the request has no `mailbox`;
  - US2-AS4 and FR-020: a domain administrator's `MailboxSearchPicker` offers only mailboxes of `example.org`, never the resource, and searches as they type; `?mailbox=` from the filtered list preselects the target;
  - Edge: `sync-jobs-domain-admin-no-mailboxes` shows the empty picker explaining that a mailbox must exist first;
  - US2-AS5 and FR-031, FR-032, FR-034: the password is masked, the reveal toggle has a name and `aria-pressed`, the username field has `autocomplete="off"`, the password `autocomplete="new-password"` and the password-manager opt-out attributes, and the plain-text notice is shown;
  - US2-AS6 and FR-024: switching on "Delete from source when completed" or "Delete messages on destination that are not on source" shows the permanent-deletion warning; "Simulate" explains that nothing is copied;
  - FR-025: the imapsync option names are shown as secondary text;
  - FR-021: help texts show the ranges and the allowed custom options from the capabilities; client checks block submission of empty required fields, too-long values and out-of-range numbers without a request;
  - US2-AS7, FR-022 and SC-006: for each documented rule the UI can trigger (an IPv6 host and a malformed host name → `hostName`, `invalidRegex`, `optionNotAllowed`, `optionContainsSpace`, `outOfRange` on each number, `tooLong`, `notEligible` through `?mailbox=` naming the resource, `customParamsNotPermitted` after the restriction is switched on at runtime), the server error appears on its field in en-gb and cs-cz, a collapsed section with the error opens, the error summary is announced and focused, and its links focus the fields. The rules the client checks prevent from reaching the API (`required`, `tooShort`) and `immutable` (the app never sends `mailbox` in a patch) are covered by T018;
  - US2-AS8 and FR-023: a duplicate shows "already exists" with "Open the existing job" linking to the `syncJobId` of the problem, and keeps every value;
  - US2-AS9 and FR-028: success is announced, the details screen of the new job opens (Back does not return to the form), and the job is in the list;
  - FR-056: `sync-jobs-user-restricted-params` has no custom parameters field and never sends it;
  - FR-027: leaving the form with input asks for confirmation;
  - FR-049: number fields have `inputmode="numeric"`; host, username, pattern and parameters have `autocapitalize="none"`, `autocorrect="off"` and `spellcheck="false"`;
  - Edge: the session expiring at runtime while the form holds a password leads to sign-in; after signing in again the form is empty.
- [X] T042 [P] [US2] Write `tests/e2e/sync-jobs/password-secrecy.spec.ts` with the create flow (research R12, FR-029 to FR-035, FR-054, SC-003): with a marker password, after creating the job the marker is absent from `page.content()`, from every visited URL, from `localStorage`, `sessionStorage` and `history.state`, and appears in exactly one recorded mock request body (`createSyncJob`); no request goes to any origin but the app's; the UI 001 storage allowlist still holds.
- [X] T043 *(done: `form-components.spec.ts` (password field and the form's fields) and `SyncJobCreatePage.spec.ts`)* [P] [US2] Write the component tests in `tests/unit/features/sync-jobs/`:
  - `RemotePasswordField.spec.ts`: masked by default, the reveal toggle, the attributes of research R12, masked again and cleared on unmount, the hint variants (create, "A password is saved. Leave empty to keep it.", "No password is saved");
  - `SourceFields.spec.ts`: encryption options from `capabilities.encryptions`, the port rule wired to the form model, numeric input parsing;
  - `DuplicateFields.spec.ts`: warnings while switched on, option names;
  - `ExpertFields.spec.ts`: no custom parameters field on create when not allowed; read-only stored value with the reason in edit mode; the allowed options listed;
  - `SyncJobCreatePage.spec.ts`: loading and error states of the capabilities read, the body from `form-model.ts`, `router.replace` to the details on success, the exists alert with its link, focus on the error summary after a refusal, the leave guard only while the form holds input.
- [ ] T044 [P] [US2] Add the create cases to `tests/smoke/sync-jobs.smoke.spec.ts`: alice creates a job for `imap.smoke.invalid` and repeating it shows "already exists" with a link; `admin` creates a job for alice through the mailbox picker. Record created IDs for the cleanup in T071.

### Implementation for User Story 2

- [X] T045 [P] [US2] Implement `src/features/sync-jobs/components/RemotePasswordField.vue` (research R12: local `ref` only, `type="password"`, `autocomplete="new-password"`, `data-1p-ignore`, `data-lpignore="true"`, `data-bwignore`, `data-form-type="other"`, the reveal toggle, the `add.syncjob_hint` notice, cleared on save, cancel and unmount).
- [X] T046 *(done under the 1:1 rule as one `SyncJobFormFields.vue` in the classic order for both forms)* [P] [US2] Implement the field groups in `src/features/sync-jobs/components/`: `SourceFields.vue`, `ScheduleFields.vue`, `FolderFields.vue`, `DuplicateFields.vue`, `LimitFields.vue` and `ExpertFields.vue`, each in a `create` and an `edit` mode, on `FormField`, with help texts from the capabilities, option names in `<code>`, the warnings of FR-024, `inputmode="numeric"` and the attributes of FR-049. T043's field tests must pass.
- [X] T047 *(done: the owner is the shared `MailboxSearchPicker` (UI 003); success shows legacy's message on the new job's page (`outcome.ts`))* [US2] Implement `src/features/sync-jobs/pages/SyncJobCreatePage.vue` (capabilities read first; the target section with `MailboxSearchPicker` and its empty-result slot, or the mailbox user's own address; the six other sections in `FormSection`; client checks; `useProblemForm` with `field-messages.ts`; the leave guard; on success `router.replace` to `sync-job-detail` and a polite announcement), add the `sync-job-create` route to `src/features/sync-jobs/routes.ts`, and add the "Add sync job" action to the header and the empty state of `src/features/sync-jobs/pages/SyncJobsPage.vue`, passing the list's `mailbox` filter as `?mailbox=`. T041 to T043 must pass.
- [ ] T048 [US2] Add the create new strings of the legacy form map (hints with ranges and lengths where legacy has none, warnings, the error messages of research R13 without a legacy `danger.*` equivalent including `syncJobs.errors.kind.*`, every `enums.syncJobEncryption.*` key, `validation.format.hostName`, the codes `invalidRegex`, `optionNotAllowed`, `optionContainsSpace` and `customParamsNotPermitted`, and `problem.permission-flag-required` unless present) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`; append those rule codes and problem types to the enumeration scope manifest. Use verbatim, in the add modals' order: `add.syncjob`, `user.create_syncjob`, `add.syncjob_hint`, `add.hostname`, `add.port`, `add.username`, `add.password`, `add.enc_method`, `add.select`, `add.mins_interval`, `edit.subfolder2`, `edit.maxage`, `edit.maxbytespersecond` (HTML, through `SanitizedHtml.vue`), `edit.timeout1`, `edit.timeout2`, `add.exclude`, `add.custom_params`, `add.custom_params_hint`, `add.delete2duplicates`, `add.delete1`, `add.delete2`, `add.automap`, `add.skipcrossduplicates`, `add.subscribeall`, `add.dry`, `add.active` and `admin.add`; and the messages `success.mailbox_modified` (`%s` the target mailbox) and `danger.object_exists` (`%s` "host / user", for `problem.sync-job-exists`). Run `npm run i18n:check`.

**Checkpoint**: US1 and US2 work: jobs can be listed, inspected and created.

---

## Phase 5: User Story 3 - Edit a sync job without exposing the remote password (Priority: P1)

**Goal**: Each details section except Target mailbox has its own edit and save, driven by the
`edit` address parameter, sending only the changed fields with the loaded version; outdated saves
keep the input and mark the changes; the password stays write-only.

**Independent Test**: Open a job, check that no password appears, change one option and save, see
that the request leaves the password out; save a new password and see it sent once and never shown
again (spec US3).

### Tests for User Story 3 (write first; must fail)

- [X] T049 *(done under the 1:1 rule: one section `?edit=syncjob` with the edit page's form)* [P] [US3] Write `tests/e2e/sync-jobs/edit.spec.ts`:
  - US3-AS1 and FR-030: editing Source (`?edit=source`) shows the stored values, an empty password field and "A password is saved. Leave empty to keep it."; a legacy job without a password shows "No password is saved";
  - US3-AS2 and FR-026: changing only the interval in Schedule sends `{ "intervalMinutes": … }` with `If-Match` equal to the loaded `etag`; saving an unchanged section sends nothing;
  - US3-AS3: a new password is sent once in the Source patch; editing Source again shows the empty field;
  - US3-AS4 and FR-020: Target mailbox has no edit action and no patch ever contains `mailbox`;
  - US3-AS5 and FR-026: after a runtime change "elsewhere", saving Folders is refused as outdated, the input stays, the reloaded values that changed are marked, "Save again" succeeds, and "Discard my changes" (in a second run) shows the reloaded values; there is no "overwrite anyway";
  - US3-AS6 and FR-027: leaving the screen with a changed section asks for confirmation; "Cancel" and Back close a section and discard its input;
  - FR-028: a successful save is announced and the section returns to read mode with the saved values;
  - at 360 px an open section replaces the page content with its heading and a sticky Save and Cancel bar; from `md` up it opens in place; one section edits at a time; a reload with `?edit=folders` reopens that section with the saved values;
  - FR-017: on a phone, editing a collapsed advanced section opens it;
  - FR-022 and FR-023: field errors in a section (`outOfRange`, `invalidRegex`, `optionNotAllowed`) appear on their fields; changing the remote user and host to a duplicate shows "already exists" with the link;
  - FR-056: `sync-jobs-user-restricted-params` sees the stored custom parameters read-only with the reason, can still change "Simulate", and the patch never contains `customParameters`;
  - FR-038: saving a running job says that the run in progress finishes on its own;
  - Edge: a job deleted at runtime during an edit shows "This sync job no longer exists" with a link to the list.
- [X] T050 [P] [US3] Extend `tests/e2e/sync-jobs/password-secrecy.spec.ts` with the edit flow: the marker typed as a new password in Source appears in exactly one `updateSyncJob` body; a Schedule save without touching the password sends no `remotePassword`; afterwards the marker is absent from the page, the URLs, storage and `history.state`, and a reload with `?edit=source` shows the empty password field.
- [X] T051 [P] [US3] Write `tests/unit/features/sync-jobs/SyncJobDetailPage.spec.ts`: sections wrapped in `EditableSection` with the field groups in `edit` mode and the `edit` address parameter (invalid values removed); the patch from `form-model.ts`; the outdated path with `changedSince()` marking, "Save again" and "Discard my changes"; the leave guard only with changed input; the running note.
- [ ] T052 [P] [US3] Add to `tests/smoke/sync-jobs.smoke.spec.ts`: alice changes the interval of her created job and sees it after a reload.

### Implementation for User Story 3

- [X] T053 [US3] Extend `src/features/sync-jobs/pages/SyncJobDetailPage.vue`: every section except Target mailbox becomes an `EditableSection` driven by `?edit=<section>`, rendering its field group in `edit` mode, saving the patch of `form-model.ts` through `updateSyncJob` and `useVersionedSave` (`If-Match`, `412` with `changedSince()`, "Save again", "Discard my changes"), mapping errors with `field-messages.ts`, showing the exists alert, the running note and the not-found path, clearing the password on save and cancel, and guarding leaving with the leave guard. T049 to T051 must pass.
- [X] T054 [US3] Add the edit new strings of the legacy form map (the saved-password hints, the read-only custom parameters reason, the outdated and marked-value texts, the running note) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Use verbatim the edit page's keys (`edit.syncjob`, `edit.hostname`, `edit.username`, `edit.password`, `edit.encryption`, `edit.mins_interval`, `edit.exclude`, `edit.delete2duplicates`, `edit.delete1`, `edit.delete2`, `edit.automap`, `edit.skipcrossduplicates`, `edit.active`, `edit.save` and the others of the map) and `success.mailbox_modified` (`%s` the target mailbox) after a save. Run `npm run i18n:check`.

**Checkpoint**: The three P1 stories work: list, create and edit.

---

## Phase 6: User Story 4 - Activate, deactivate and schedule the next run (Priority: P2)

**Goal**: Single-job actions from the list and the details, and a selection mode whose bulk request
carries each job's version, with a per-job summary.

**Independent Test**: Toggle one job and a selection of three with one failing, and check the
requests, the updated list and the per-job summary (spec US4).

### Tests for User Story 4 (write first; must fail)

- [X] T055 *(done under the 1:1 rule: activate, deactivate and schedule next are the classic mass actions on a selection of one or more jobs (plan deviation 5); deactivating asks once)* [P] [US4] Write `tests/e2e/sync-jobs/actions.spec.ts`:
  - US4-AS1 and FR-036: deactivating from a card or row menu and from the details asks one explicit confirmation that names the job and says it will not run until activated again; cancelling sends nothing and returns focus; confirming sends `PATCH { "active": false }` with `If-Match`, the job shows "Inactive" and the change is announced; activating sends `PATCH { "active": true }` without a confirmation;
  - FR-047: a `route.abort()` on deactivate shows UI 001's retry message and leaves the job unchanged in the list;
  - US4-AS2: "Schedule next" sends `POST …/schedule-reset` without `If-Match`; the last run reads "Cleared, runs on the next cycle", the result is cleared and the state reads "Waiting";
  - FR-036, Edge: after a runtime change "elsewhere", deactivating says that the job changed, shows its current values and lets the user retry successfully;
  - FR-038, Edge: deactivating or rescheduling a running job says that the run in progress finishes on its own;
  - FR-014: the list shows the new values without a manual refresh.
- [X] T056 [P] [US4] Write `tests/e2e/sync-jobs/bulk-actions.spec.ts` with `sync-jobs-bulk`:
  - US4-AS3 and FR-037: activating three selected jobs, one of them in `failBulkItems`, sends one `POST /sync-jobs/bulk-actions` whose body is `{ action: 'activate', targets: [{ id, version }] }` with each `etag` without quotes as listed; the summary counts two successes and names the failed job with its translated reason; the failed job stays selected and "Retry" sends only it;
  - US4-AS4: at 360 px `BulkActionBar`'s "Select" starts selection mode, every card gets a checkbox of at least 44 × 44 px named after its job, and the bar wraps without horizontal scrolling;
  - FR-037: "Select all on this page"; the selection clears after changing page, search, a filter, the sort or the page size; an outdated item (changed at runtime) stays selected and a not-found item (deleted at runtime) leaves the selection; bulk deactivate asks one explicit confirmation listing the jobs, bulk schedule next run does not;
  - FR-037, Edge: a `route.abort()` on the bulk request reports "outcome unknown" for every selected job, clears the selection, refetches the list, and sends no second bulk request;
  - FR-037: with the capabilities `bulkLimit` set to 2 at runtime, selecting the page selects at most two jobs and says so, and the bulk request names at most two;
  - SC-008: a bulk action on 25 jobs shows 25 outcomes;
  - FR-014: no automatic refresh happens while selection mode is on, and it resumes after leaving it.
- [X] T057 [P] [US4] Write `tests/unit/features/sync-jobs/useSyncJobActions.spec.ts`: single actions (the deactivation confirmation through `useConfirm` and nothing sent on cancel, patch bodies, `If-Match`, reschedule without it, `412` handling, announcements, the running note, cache writes); bulk (targets with quotes stripped, `bulkLimit` passed to `useBulkSelection`'s `limit`, the selection snapshot naming `BulkResultSummary` rows, outcome to selection retention, "Retry" with refreshed versions, network failure as "outcome unknown" with the selection cleared, no automatic retry).
- [ ] T058 [P] [US4] Add to `tests/smoke/sync-jobs.smoke.spec.ts`: alice deactivates her created job and schedules its next run; `admin` deactivates and activates the two jobs created for alice in one bulk action each.

### Implementation for User Story 4

- [X] T059 *(done: single-job activate, deactivate and schedule next go through the selection (plan deviation 5); "Schedule next" only for administrators and domain administrators, as the classic tabs (plan deviation 4))* [US4] Implement `src/features/sync-jobs/composables/useSyncJobActions.ts`: activate, deactivate (with its confirmation) and schedule next for one job (research R14) and the bulk flow (with the bulk deactivation confirmation) on `useBulkSelection` and `applySyncJobBulkAction` (research R15, the selection snapshot of data-model §2), with `BulkResultSummary` rows, announcements and the running notes. T057 must pass.
- [X] T060 *(done: selection mode with the shared `SelectCheckbox` ("Toggle all", `mailbox.toggle_all`), `BulkActionBar` and `BulkResultSummary`; no actions on the job page (conventions "Detail pages", plan deviation 6))* [US4] Wire selection mode into `src/features/sync-jobs/pages/SyncJobsPage.vue` (`BulkActionBar` with Activate, Deactivate and Schedule next, `BulkResultSummary`, the capabilities read on entering selection mode, `useListState`'s `onReset`, `useRunningRefresh`'s selection input), `SyncJobCard.vue` and `SyncJobTable.vue` (checkboxes, "select all on this page"); add Activate or Deactivate and "Schedule next" to `SyncJobRowActions.vue` and to the details header in `SyncJobDetailPage.vue`. T055 and T056 must pass.
- [X] T061 *(done: `mailbox.last_run_reset`, `mailbox.activate`, `mailbox.deactivate`, `mailbox.remove` through `enums.syncJobBulkAction.*` (`LEGACY_TEXTS`); new strings only for the deactivation confirmation; `mailbox.quick_actions` is not needed (the bar names its actions))* [US4] Add the action messages (the deactivation confirmations for one job and a selection, selection mode, the bar's sync-job wording, every `enums.syncJobBulkAction.*` key, announcements, the running note; only those the legacy form map lists as new) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, and use `mailbox.activate`, `mailbox.deactivate`, `mailbox.last_run_reset`, `mailbox.quick_actions` and `mailbox.toggle_all` verbatim; run `npm run i18n:check`.

**Checkpoint**: US4 works on its own on top of US1.

---

## Phase 7: User Story 5 - Read the run log (Priority: P2)

**Goal**: A log viewer opened from the result, the menus and the details: full screen on phones, a
large dialog on wide screens, verbatim with control characters made visible, wrapping by default,
copyable, closed by Back, and fast with 5 MB logs.

**Independent Test**: Open logs of different sizes and contents, including an empty log, markup-like
text and a 5 MB log, on both viewports; check that the text is verbatim and can be copied (spec
US5).

### Tests for User Story 5 (write first; must fail)

- [X] T062 *(done: opened from "Check log" and "Open logs" in the list only (the job page has no log, plan deviation 6); the viewer's Close is its title bar button)* [P] [US5] Write `tests/e2e/sync-jobs/log.spec.ts`:
  - US1-AS5 and FR-007, FR-041: "Check log" on a failed job opens the log directly; "Open logs" in the card and row menus and the details header opens it too;
  - US5-AS1 and FR-042: the text is shown verbatim, whitespace preserved, in a fixed-width font, read-only, with the source, target mailbox, last run and last result in the header; a bidi override character in the log is shown as a visible `U+202E` marker;
  - US5-AS2 and FR-043: at 360 px the viewer fills the screen; long lines wrap by default; with wrapping off only the log area scrolls sideways (no page horizontal scroll); the log area has an accessible name and scrolls with the keyboard; on desktop it is a large dialog;
  - US5-AS3 and FR-044: "Copy" puts exactly the log text returned by the API on the clipboard (checked on the Chromium projects with clipboard permissions; on `mobile-webkit` only the announcement is checked) and announces it; a refused clipboard says that copying is not available;
  - US5-AS4 and FR-045: a never-run job shows "No log yet"; a run without output shows "The run produced no output"; a running job shows the previous run's log with the notice and a working Refresh;
  - US5-AS5: markup-like text (`<script>alert(1)</script>`, `&amp;`) appears as literal text and creates no element;
  - FR-046: opening the list requests no log; opening the viewer requests exactly one;
  - research R17: Back closes the viewer and keeps the list state; opening `?log=<id>` directly shows it; closing returns focus to the opener; a job deleted at runtime shows the "no longer exists" message inside the viewer.
- [X] T063 [P] [US5] Write `tests/e2e/sync-jobs/log-performance.spec.ts` (Chromium only, `sync-jobs-big-log`, CDP CPU throttling 4×): the 5 MB log is readable (its first and last lines reachable) within 3 s of opening, and scrolling from top to bottom records no long task over 200 ms (`PerformanceObserver`) (SC-007, FR-046).
- [X] T064 *(done: `log-view.spec.ts`, `useLogViewer.spec.ts`, `log-components.spec.ts` (text and dialog) and `tests/unit/shared/security/plain-text.spec.ts`)* [P] [US5] Write the unit tests in `tests/unit/features/sync-jobs/`: `log-view.spec.ts` (chunks of 500 lines that join back to the exact input, including CRLF, a trailing newline, U+FFFD and an empty string; the state table of data-model §2), `useLogViewer.spec.ts` (push on open, back or replace on close, removal of an invalid or foreign `log` value, focus return), `SyncJobLogText.spec.ts` (text interpolation only, `neutralise()` markers for control and bidi characters, wrap classes, `content-visibility` class per chunk, `dir="auto"`, region name, `tabindex="0"`) and `SyncJobLogDialog.spec.ts` (full screen below `md`, header values, copy of the original text with success and refusal announcements, Refresh refetching).
- [ ] T065 [P] [US5] Add to `tests/smoke/sync-jobs.smoke.spec.ts`: alice opens the log of job #2 and sees imapsync output without any password.

### Implementation for User Story 5

- [X] T066 [US5] Implement `src/features/sync-jobs/log-view.ts` and `src/features/sync-jobs/composables/useLogViewer.ts` (the `log` address parameter through `list-state.ts` on the list and `route.query` on the details; push, back or replace; focus return), so that the matching parts of T064 pass.
- [X] T067 *(done: `neutralise()` created at `src/shared/security/plain-text.ts` (T004); unwrapped chunks take their content's width, because `content-visibility` contains painting)* [US5] Implement `src/features/sync-jobs/components/SyncJobLogText.vue` (chunks displayed through `neutralise(chunk, { multiline: true })`, `shallowRef`, wrap toggle, region) and `SyncJobLogDialog.vue` (Reka `Dialog`, full screen below `md` and up to 64 rem × 90 vh from `md`, header, Copy of the original text through `src/shared/platform/clipboard.ts`, Wrap lines, Refresh, Close, `NotFoundState` for a gone job), loaded lazily; make "Check log" in `SyncJobResult.vue` a link that opens it; add "Open logs" to `SyncJobRowActions.vue` and the details header; mount the viewer in `SyncJobsPage.vue` and `SyncJobDetailPage.vue`. T062 to T064 must pass.
- [X] T068 [US5] Add the log messages (viewer title, header labels, Copy, copied, copy unavailable, Wrap lines, "No log yet", "The run produced no output", the running notice, the region name; the classic log title "Log" is hard-coded, so it is a new string) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, and use `mailbox.open_logs` verbatim; run `npm run i18n:check`.

**Checkpoint**: US5 works on its own on top of US1.

---

## Phase 8: User Story 6 - Delete sync jobs (Priority: P2)

**Goal**: Deleting one job after a confirmation that names it, or a selection after a confirmation
that lists every job and asks for their number.

**Independent Test**: Delete one job and a selection, cancel once, and check the confirmation, the
requests and the list afterwards (spec US6).

### Tests for User Story 6 (write first; must fail)

- [X] T069 *(done: removal from the row menu and the selection; the job page has no removal (conventions "Detail pages"))* [P] [US6] Write `tests/e2e/sync-jobs/delete.spec.ts`:
  - US6-AS1 and FR-039: the dialog names the source account, server and target mailbox, says that copied mail stays in the mailbox, starts with focus on Cancel, and its confirming control is marked destructive;
  - US6-AS2: cancelling deletes nothing and returns focus to the control that opened the dialog;
  - US6-AS3 and FR-037, FR-039: deleting three selected jobs lists all three, keeps the confirm button disabled until "3" is typed, sends one bulk `delete` with their versions, and reports any job that was not deleted;
  - FR-039: a single deletion refused as outdated reloads the job and asks for confirmation again;
  - FR-040: the job disappears from the list; deleting from the details returns to the list and announces the deletion;
  - FR-038, Edge: deleting a running job says that the run in progress finishes on its own.
- [X] T070 [P] [US6] Extend `tests/unit/features/sync-jobs/useSyncJobActions.spec.ts` with the delete cases (`If-Match`, the `412` re-confirmation, cache removal, the typed count and the job list passed to `useConfirm`) and write `tests/unit/features/sync-jobs/SyncJobDeleteList.spec.ts` (each job's label and target, a scrollable list with an accessible name, the copied-mail note, the running note).
- [ ] T071 [P] [US6] Add to `tests/smoke/sync-jobs.smoke.spec.ts`: alice deletes her created job; `admin` deletes the two jobs created for alice in one bulk deletion with the typed count; an `afterAll` deletes any job the suite created that still exists, so the seeded data stays unchanged.

### Implementation for User Story 6

- [X] T072 *(done: "Remove" in the row menu and the selection bar; not on the job page (plan deviation 6))* [US6] Add delete to `src/features/sync-jobs/composables/useSyncJobActions.ts` (single through `deleteSyncJob` with the `412` re-confirmation; bulk through `applySyncJobBulkAction` with `requireTyped`), implement `src/features/sync-jobs/components/SyncJobDeleteList.vue`, and add "Delete" (`mailbox.remove`) to `SyncJobRowActions.vue`, to the `BulkActionBar` actions in `SyncJobsPage.vue`, and to the details header in `SyncJobDetailPage.vue` (returning to the list with `router.replace`). T069 and T070 must pass.
- [X] T073 [US6] Add the delete new strings of the legacy form map (dialog titles and texts, the typed-count prompt) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, and use `mailbox.remove`, `success.deleted_syncjob` (`%s` the ID) and `success.deleted_syncjobs` verbatim for the action and its announcements; run `npm run i18n:check`.

**Checkpoint**: All user stories work on their own.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story verification, budgets, translations and validation on devices and the real
API.

- [ ] T074 [P] Write and pass `tests/e2e/sync-jobs/reflow-keyboard.spec.ts`: every screen and dialog of this feature (list, details with a section in edit mode, create form, selection bar, bulk summary, delete dialogs, log viewer) has no horizontal scroll at 320 px and at 400 % zoom (320 CSS px on a 1280 px desktop), works in landscape on the mobile projects, never hides the focused element behind the sticky header, and runs no transition under `prefers-reduced-motion: reduce`; the main path of each of US1 to US6 completes with the keyboard alone with visible focus (FR-048, FR-050, SC-004 together with the axe checks of every end-to-end spec).
- [ ] T075 Run `npm run i18n:check`, remove unused `syncJobs.*` keys it reports from `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, and list the new cs-cz and sk-sk strings (written by hand, never machine-translated) for the owner's review in a "Strings for review" section appended to `specs/008-sync-jobs/quickstart.md` (plan, owner question 2; SC-005).
- [ ] T076 Run `npm run build && npm run budget:check`: the initial JavaScript is unchanged and the sync-job chunks (three pages and the log viewer) stay under 25 KB gzipped together; record the sizes in the validation log of `specs/008-sync-jobs/quickstart.md` (research R22).
- [ ] T077 [P] Add the plan's four parity notes (cleared last run label, "Success" for an unrecognised success code, the linkable log closed by Back, the deactivation confirmation) to the "Legacy Parity" table of `specs/008-sync-jobs/spec.md` (SC-009).
- [ ] T078 Run `quickstart.md` Part B on a mid-range Android phone and an iPhone with `npm run preview:mock` on the local network; record SC-001, SC-002 and SC-007 and a screen-reader pass of every user story (VoiceOver, TalkBack) in the validation log of `specs/008-sync-jobs/quickstart.md`.
- [ ] T079 Run `quickstart.md` Part C (`scripts/smoke/stack-up.sh`, `npm run test:smoke -- tests/smoke/sync-jobs.smoke.spec.ts`, `scripts/smoke/stack-down.sh`) once the mailcow-rest-v2 dev stack serves API 008 with its seeded data, and record the result in the validation log of `specs/008-sync-jobs/quickstart.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 first (types for everything else). T002 → T003. T004 after T001.
- **Foundational (Phase 2)** depends on Setup and **blocks every user story**:
  - T004a first: every screen and message task depends on the legacy form map;
  - T005 → T006, T007 → T008, T009 → T010 (T005/T006 and T009/T010 only when T004 found the part
    missing);
  - T011 → T012 → T013 → T014;
  - T015 to T018 in parallel (T015 after T014, because it runs against the mock), then T019
    (after T015), T020 (after T016), T021 (after T017), T022 (after T018).
- **User stories (Phases 3 to 8)** depend on Foundational and on each other as below.
- **Polish (Phase 9)** depends on every story it verifies; T079 also needs the API's dev stack.

### User Story Dependencies

| Story | Priority | Depends on | Why |
|---|---|---|---|
| US1 | P1 | Foundational | MVP: list, details read mode, History, automatic refresh, mailbox entry point |
| US2 | P1 | US1 | The create action lives on the list page (T047 edits `SyncJobsPage.vue`), and success opens the details screen |
| US3 | P1 | US1, US2 | Section edit mode extends `SyncJobDetailPage.vue` and reuses the US2 field groups and password field |
| US4 | P2 | US1 | Actions extend the list, the row menu and the details header |
| US5 | P2 | US1 | The viewer opens from the list, the result and the details |
| US6 | P2 | US1; US4 for bulk deletion | Single deletion needs only US1; bulk deletion uses US4's selection mode and `BulkActionBar` wiring |

US1-AS5's "direct way to open the run log" is tested in US5 (T062), where the link is built; US1
shows "Check log" as text until then.

### Files edited by several stories

Edits to these files must be serialised, even when the stories run in parallel:

- `src/features/sync-jobs/pages/SyncJobsPage.vue`: US1, US2, US4, US5, US6;
- `src/features/sync-jobs/pages/SyncJobDetailPage.vue`: US1, US3, US4, US5, US6;
- `src/features/sync-jobs/components/SyncJobRowActions.vue`: US1, US4, US5, US6;
- `src/features/sync-jobs/components/SyncJobCard.vue` and `SyncJobTable.vue`: US1, US4;
- `src/features/sync-jobs/composables/useSyncJobActions.ts`: US4, US6;
- `src/features/sync-jobs/components/SyncJobResult.vue`: US1, US5;
- `src/features/sync-jobs/routes.ts`: US1, US2;
- `tests/smoke/sync-jobs.smoke.spec.ts`: US1, US2, US3, US4, US5, US6;
- `tests/e2e/sync-jobs/password-secrecy.spec.ts`: US2, US3;
- `tests/unit/features/sync-jobs/useSyncJobActions.spec.ts`: US4, US6;
- `src/i18n/messages/*.json` (new strings only) and the enumeration scope manifest: every story;
- outside the feature: `src/app/router/routes.ts`, `src/app/navigation/catalogue.ts`,
  `src/features/mailboxes/pages/MailboxDetailPage.vue` (US1) and UI 006's rate-limits feature
  (T008), shared with other features' work.

### Within Each User Story

- Tests first (end-to-end, unit and component, smoke), which must fail; then logic and
  composables, then components, then pages and routes; then the messages in all three locales.
- Message tasks edit the shared locale files: run them one after another across stories.

### Parallel Opportunities

- Setup: T002 alongside T004 after T001.
- Foundational: the optional pairs, T011, and T015 to T018 in parallel; T020 to T022 in parallel.
- US1: T023 to T030 in parallel; then T032, T033, T035 and T037 in parallel; T034 after T032; T036
  after T033.
- After US1: US4 and US5 can be staffed in parallel with US2 → US3; US6's single deletion can start
  after US1, its bulk part after US4.
- Within each story, every task marked [P].

---

## Parallel Example: User Story 1

```bash
# After the foundation, write all US1 tests together:
Task: "T023 tests/e2e/sync-jobs/list.spec.ts"
Task: "T024 tests/e2e/sync-jobs/scope-access.spec.ts"
Task: "T025 tests/e2e/sync-jobs/detail.spec.ts"
Task: "T026 tests/e2e/sync-jobs/auto-refresh.spec.ts"
Task: "T027 tests/e2e/sync-jobs/entry-points.spec.ts"
Task: "T028 tests/unit/features/sync-jobs/{list-state,useInactivity,useRunningRefresh}.spec.ts"
Task: "T029 tests/unit/features/sync-jobs/*.spec.ts (components)"
Task: "T030 tests/smoke/sync-jobs.smoke.spec.ts"

# Then the independent parts together:
Task: "T032 composables/useInactivity.ts"
Task: "T033 SyncJobStateBadges.vue, SyncJobResult.vue, SyncJobLastRun.vue"
Task: "T035 FormSection.vue, SyncJobSectionValues.vue"
Task: "T037 MailboxSyncJobsLink.vue + placement in UI 003's mailbox detail"
# T031, T034, T036, T038, T039 and T040 follow in order.
```

## Parallel Example: User Stories 4 and 5

```bash
# After US1, two developers:
Task: "T055–T058 US4 tests"   Task: "T062–T065 US5 tests"
Task: "T059 useSyncJobActions.ts"   Task: "T066 log-view.ts + useLogViewer.ts"
# T060 and T067 both edit SyncJobsPage.vue, SyncJobDetailPage.vue and SyncJobRowActions.vue:
# run them one after another.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 and Phase 2: the pin, the prerequisites, the mock and the core logic.
2. Phase 3 (US1): users see their jobs, failures and details; the classic interface still creates
   and edits.
3. **Stop and validate**: `npm run test:e2e -- tests/e2e/sync-jobs --grep US1` on both viewports and
   the US1 rows of quickstart Part B.

### Incremental Delivery

1. Foundation, then US1 (MVP).
2. US2 (create), then US3 (edit): the P1 set replaces the classic add modal and edit page.
3. US4 (actions and bulk), US5 (log), US6 (delete): the P2 set completes parity.
4. Polish: reflow and keyboard checks, translations review, budgets, device validation and the
   smoke run.

### Parallel Team Strategy

After Foundational:
- Developer A: US1, then US2, then US3.
- Developer B (after US1): US4, then US6.
- Developer C (after US1): US5, then Polish preparation.

Edits to the shared files listed under "Files edited by several stories" run one at a time.

---

## Notes

- [P] tasks touch different files and have no dependency on an incomplete task.
- [USn] labels map tasks to the spec's user stories; test titles carry the spec IDs for traceability.
- Verify that each test fails before implementing (constitution VI).
- Commit after each task or logical group, directly to `main`, with short imperative subjects.
- Never add a hand-written API type, a `v-html`, an inline style or script, a storage key, a
  hard-coded limit or default (FR-055), or an automatic request outside research R7.
- The remote password never leaves its field component except in the create and Source-save
  request bodies.
