# Research: Sync Jobs

**Feature**: `specs/008-sync-jobs` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

UI 001 decided the stack, the structure, contract pinning, the mock API, the test layers, i18n,
sessions and the shared primitives ([UI 001 research](../001-sign-in-app-shell/research.md), cited
as "001 R<n>"). This document records only what is specific to sync jobs. Open points are settled
in this order: the constitution, then the pinned mailcow-rest-v2 contract, then
`docs/conventions.md`, then UI 001's decisions, then best practice. Each entry has a **Decision**,
its **Rationale** and the **Alternatives considered**.

UI 008 is implemented after UI 001 to UI 007 and after API 008's contract is merged (it is: module
`api/modules/sync-jobs/`). It adds **no runtime dependency**.

---

## 1. Contract and prerequisites

### R1. Contract pin

- **Decision**: UI 008 needs these 9 operations of API 008, plus `listMailboxes` (API 003),
  `listDomains` (API 002), `listAuditEvents` with `targetType`/`targetId` and `getIdentity`
  (API 001); the full list is in [contracts/README.md](./contracts/README.md).
  - **Planning baseline**: mailcow-rest-v2 commit `32079252d55797d3da4e58ae661e9fb91c51c6f9`
    ("Register KnownProblemType in contract components", 2026-10-18). The sync-jobs contract last
    changed in `0fb4f73` ("Use requiredFlags in feature 008 permission refusals"), so the baseline
    contains its final form. The Redocly 2.64.1 bundle of the baseline has 376 operations and
    sha256 `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6` (computed while
    planning; the bump script recomputes it).
  - **Pin rule**: pins only move forward, because UI 001 to UI 007 each bump to the operations they
    need and every later pin contains every earlier feature's contract. The first task of UI 008
    (T001) therefore:
    1. keeps the current pin when `contract/VERSION.json` already names the baseline or a later
       commit, and otherwise runs `scripts/contract/bump.sh` with the baseline commit (or a later
       release tag that contains it);
    2. verifies that the 9 sync-job operations, their parameters, schemas and documented statuses
       in the pinned bundle are identical to the baseline (`api/modules/sync-jobs/` and the
       `SyncJob*` components). Any difference stops the feature: this plan is updated first.
  - `KnownProblemType` is now listed under `components.schemas` (UI 001 plan, API gap 5, fixed at
    the baseline), so `knownProblemTypeValues` is generated and `problem.sync-job-exists` and
    `problem.permission-flag-required` are typed constants.
- **Rationale**: `info.version` stays `0.1.0` while contracts merge into one tree (001 R6), so a
  commit is the only identifier. Verifying the module rather than trusting "latest" keeps the
  plan's facts true at implementation time.
- **Alternatives considered**: pinning exactly `0fb4f73` was rejected, because pins never move
  backwards and UI 001 to UI 007 will have pinned later commits. Pinning "HEAD at implementation
  time" without a check was rejected (001 R6).

### R2. Prerequisites from earlier UI features

- **Decision**: UI 008 builds on these parts and does not rebuild them. The locations are those of
  UI 001 R20 and of the UI 002 to UI 006 plans (cited as "002 D<n>", "003 R<n>", "004 D<n>",
  "006 R<n>"). T004 checks that each one exists before any UI 008 work starts.

  | Part | Owner | Expected location | Used for |
  |---|---|---|---|
  | Shell, router, catalogue entry `syncJobs`, `canAccess`, `NoAccessState`, `NotFoundPage` | UI 001 | `src/app/**` | FR-001, FR-003 |
  | `useListState`, `ListState`, `PaginationBar`, `useConfirm`, `useVersionedSave`, `useProblemForm`, `FormField`, `ErrorSummary`, `ProblemMessage`, `DateTime`, `RelativeTime`, `useAnnouncer`, `useMediaQuery`, `PageHeader` | UI 001 | `src/shared/**` | lists, forms, dialogs, announcements |
  | `clipboard.ts`; the i18n check with `ENUM_NAMESPACES` | UI 001 | `src/shared/platform/clipboard.ts`; `scripts/i18n/lib.mjs` | log copy (FR-044); R19 |
  | `useBulkSelection` (with its `limit` option), `BulkActionBar`, `BulkResultSummary` | UI 002 D22, 004 D2–D4 | `src/shared/composables/useBulkSelection.ts`, `src/shared/components/{BulkActionBar,BulkResultSummary}.vue` | FR-037 |
  | `ConfirmDialog` with `requireTyped` and list content | UI 002, 004 D5 | `src/shared/components/ConfirmDialog.vue` | FR-039 |
  | `EditableSection` driven by the `edit` address parameter, and `changedSince()` of `useVersionedSave` ("Save again", "Discard my changes") | UI 002 D11 | `src/shared/components/EditableSection.vue`, `src/shared/composables/useVersionedSave.ts` | FR-016, FR-026 |
  | Leave guard | UI 002 D21 | `src/shared/composables/useLeaveGuard.ts` (UI 003 R4 calls it `useUnsavedChangesGuard.ts`; the implemented name applies) | FR-027 |
  | `HistoryLink` and the audit log's `targetType`/`targetId` filters | UI 002 D26 | `src/shared/components/HistoryLink.vue`, `src/features/audit-log/list-state.ts` | FR-015 |
  | `NotFoundState`, `FilterPanel`, `ActiveFilterChips`, `SearchField` | UI 003 R4, UI 006, UI 004 | `src/shared/components/` | not-found states, list filters |
  | `DomainPicker` (domains source) | UI 003, promoted by 004 D11 | `src/shared/components/DomainPicker.vue` | domain filter |
  | `neutralise()` for untrusted multi-line text | UI 006 R9 | `src/shared/security/plain-text.ts` | log display (R17) |
  | The enumeration scope manifest for the growing shared enumerations | UI 002 D2 | `src/i18n/coverage.json` (UI 003 calls it `enum-scope.json`; the implemented name applies) | R19 |
  | `requiredFlags` readable on `ApiProblem` | 004 D14 | `src/api/problem.ts` | R13 |
  | Mailbox and domain mock handlers, factories and state | UI 002 D28, 003 R20 | `tests/mocks/handlers/{domains,mailboxes}.ts`, `tests/mocks/factories/{domain,mailbox}.ts`, `tests/mocks/scenarios/state.ts` | scenarios, pickers |
  | Mailbox detail route `mailbox-detail` and its header page actions, a designated action area | UI 003 R5, data-model §8 there | `src/features/mailboxes/pages/MailboxDetailPage.vue` | FR-004 entry point |

  A missing part from this table blocks UI 008 and is reported to its owning feature; UI 008 does
  not build a substitute. Three smaller parts may still be missing, because no earlier feature
  strictly needs them; UI 008 adds them where they belong if T004 finds them missing:
  - the session reaction to `403 permission-flag-required` (refresh the identity, as for
    `forbidden`, 001 R8), in `src/api/query/client.ts` (T005, T006). UI 004 D15 and UI 005 plan to
    add it, so it normally exists;
  - the mailbox search picker: UI 006 keeps `MailboxSearchPicker.vue` in its rate-limits feature
    as its only use. UI 008 is its second use and promotes it to
    `src/shared/components/MailboxSearchPicker.vue`, adding a free-text mode and an empty-result
    slot; if it does not exist, UI 008 creates it there test-first (T007, T008);
  - a "view" parameter kind of `useListState`, for the log viewer's `log` parameter (T009, T010).
- **Rationale**: The roadmap orders UI 008 after UI 001 to UI 007, and their plans fix the owners
  and locations of these parts. Naming them explicitly makes the dependency testable and stops a
  late feature from forking a shared pattern.
- **Alternatives considered**: building local copies of bulk selection, the bulk bar, section
  editing or the pickers was rejected (constitution VIII, conventions).

### R3. Feature area and boundaries

- **Decision**: one feature area `src/features/sync-jobs/` (001 R3). Other code reaches it only
  through `index.ts`, which exports the routes and `MailboxSyncJobsLink` (R4). The full tree is in
  [plan.md](./plan.md#source-code-repository-root). Pure logic lives in plain modules
  (`list-state.ts`, `presentation.ts`, `form-model.ts`, `field-messages.ts`, `log-view.ts`) so that
  it is unit-tested without mounting components.
- **Rationale**: matches every UI 001 feature area and keeps the logic-heavy parts testable.
- **Alternatives considered**: separate areas for admin and user screens were rejected: the
  screens are the same with role-dependent fields (FR-002, FR-020).

## 2. Navigation and server state

### R4. Routes, access and entry points

- **Decision**:
  - Routes (all lazy, 001 R19), registered under the catalogue entry `syncJobs` (`/sync-jobs`),
    whose `status` flips to `available` when the list route lands (US1):
    - `sync-jobs` `/sync-jobs`;
    - `sync-job-create` `/sync-jobs/new` (optional `?mailbox=<address>` preselects the target for
      administrators and domain administrators);
    - `sync-job-detail` `/sync-jobs/:syncJobId([1-9][0-9]{0,9})`. An identifier above
      2,147,483,647 (the contract's maximum) renders the in-place `NotFoundState` with a link to the
      list without a request, so the mock validator never sees an out-of-schema path. This is the address UI 014 maps
      `/edit/syncjob/{id}` to (UI 014 row M30).
  - **Access**: the catalogue already grants `syncJobs` to administrators and to domain
    administrators and mailbox users with `permissions.syncjobs` (001 data-model §2). Without the
    flag, `ShellLayout` renders `NoAccessState` in place and no sync-job request is sent (FR-001,
    FR-003). A `403 permission-flag-required` during the session refreshes the identity (R2), after
    which the same check hides the entry and shows `NoAccessState`. A `404` on the details page
    renders `NotFoundState` (UI 003) with a link back to the list (FR-003).
  - **Entry point into UI 003** (FR-004, conventions "Where features meet"): `index.ts` exports
    `MailboxSyncJobsLink.vue`, which renders a link to `/sync-jobs?mailbox=<address>` only when
    `canAccess('syncJobs', identity)` holds. UI 008 places it among the header page actions of UI
    003's `MailboxDetailPage.vue`, which UI 003's data-model §8 designates for later features (UI
    007 adds "Sign in as" there). It sends no request (no job count), so the mailbox screen stays as
    fast as before. Mailbox users reach their list from the navigation entry, which UI 001's
    catalogue already shows them.
- **Rationale**: the catalogue is the single source of navigation and access (001 R19). A link
  component exported from the feature keeps UI 003 free of sync-job knowledge apart from one
  placement, with no deep import.
- **Alternatives considered**: a per-mailbox job count badge on the mailbox screen was rejected as
  an extra request on every mailbox view without a requirement. A registry of extension slots in
  `src/app/` was rejected as premature (constitution VIII): one placement per later feature is
  simpler.

### R5. Query keys, freshness and invalidation

- **Decision**: keys extend 001 R9's factory in `src/api/query/keys.ts`:
  - `['sync-jobs','list',params]`, `['sync-jobs','detail',id]`, `['sync-jobs','log',id]`,
    `['sync-jobs','capabilities']`;
  - the pickers keep the keys of their shared components, under their owning roots, so that those
    features' invalidations cover them: `['domains','picker',{q}]` (`DomainPicker`, UI 007 R14
    uses the same) and `['mailboxes','picker',{q}]` (`MailboxSearchPicker`, unless UI 006 chose
    another key, which then applies).

  Freshness: the default 30 s for list, detail and pickers; `capabilities` 5 minutes (server
  configuration, read lazily, R10); `log` 30 s with `gcTime` 60 s, so that a multi-megabyte log is
  released soon after the viewer closes. The detail takes `initialData` from a cached list entry
  with `initialDataUpdatedAt` set to that list's `dataUpdatedAt` (002 D6). Mutations write the
  returned job with `setQueryData`, invalidate the lists, and invalidate `['audit-events']` so that
  History shows the new record (002 D6); the full table is in
  [data-model.md](./data-model.md#3-server-state-cache).
- **Rationale**: constitution VII and 001 R9. Writing returned jobs into the cache makes changes
  appear without a refresh (FR-014).
- **Alternatives considered**: reading capabilities at bootstrap was rejected: only users who open
  sync jobs need them.

### R6. List state in the address

- **Decision**: `src/features/sync-jobs/list-state.ts` defines the `useListState` schema
  (data-model §5): `q`, `mailbox`, `domain`, `active`, `running`, `result`, `sort`, `order`,
  `page`, `size`, plus the view parameter `log` (R17), which never resets the page or the
  selection. Default sort `id` with `desc` (newest first, FR-011), although the API's default is
  `id asc`; defaults are omitted from the address. Mailbox users get no `mailbox` and `domain`
  filters and no `mailbox` sort; values given anyway are dropped by normalisation. Sorting by
  `createdAt` and `modifiedAt`, which the API also offers, is not offered (FR-011 lists the
  columns). If UI 001's `useListState` cannot carry a parameter that is not a filter, T009 and T010 add
  that option with a unit test.
- **Rationale**: conventions "Lists"; FR-010 and FR-011.
- **Alternatives considered**: keeping `log` out of the address was rejected (R17).

### R7. Automatic refresh while a job runs

- **Decision**: `src/features/sync-jobs/composables/useRunningRefresh.ts` sets the list query's
  `refetchInterval` to 30,000 ms only while all of these hold, and to `false` otherwise:
  1. a job on the current page has `runStatus.running`;
  2. the page is visible (`refetchIntervalInBackground: false`, plus a `visibilitychange`
     listener that refetches once when the page becomes visible again and the data is older than
     30 s);
  3. selection mode is off (the bulk action sends the versions as listed, conventions);
  4. the user has not paused it with the "Pause automatic refresh" control (WCAG 2.2.2), shown only
     while condition 1 holds;
  5. the last user interaction is younger than the inactivity limit, `min(15 min,
     Session.idleTimeout)` from UI 001's session store, exactly UI 011 R5's rule. Interactions are
     tracked by `src/features/sync-jobs/composables/useInactivity.ts`, with UI 011 R5's listeners:
     passive, throttled to once per second, `pointerdown`, `keydown`, `wheel`, `touchstart` and
     `scroll` on `window`. When this condition fails, a polite live notice says that automatic
     refresh paused because of inactivity, with "Resume" (a manual refresh restarts it too). It
     never resumes on its own.

  Automatic refreshes announce nothing. The manual "Refresh" (`admin.refresh`) always works. The
  composables keep no state outside the page and stop with it.
- **Rationale**:
  - FR-014 asks the refresh while a job runs; constitution VII forbids it otherwise.
  - Every API request renews the session's idle timer (API 001), and UI 001 FR-033 forbids
    automatic requests that keep an idle session alive. The inactivity limit bounds that effect to
    one idle period after the last interaction, exactly as UI 011 R5 does, so both features behave
    alike.
  - 001 R9 says "no `refetchInterval` anywhere": this is the one deliberate, condition-bound
    exception, required by FR-014; the global default stays off. UI 011 R5 makes the same kind of
    exception for its live queries.
- **Alternatives considered**: a server push channel does not exist in the contract. Refreshing
  only the running jobs one by one was rejected: more requests than one list page. Putting
  `useInactivity` in `src/shared/` now was rejected (constitution VIII: UI 008 is its first use).
  UI 011 is implemented after UI 008 and plans its own `useInactivity.ts`; it should promote UI
  008's to `src/shared/composables/` instead of writing a second one (reported to the
  orchestrator).

### R8. State, result and last run

- **Decision**: pure functions in `src/features/sync-jobs/presentation.ts`, with decision tables in
  data-model §2:
  - **State** (FR-005, FR-006): `running` when `runStatus.running`; otherwise `waiting` when
    `active`; otherwise `inactive`. An inactive job that is still running shows both badges. Each
    badge has an icon and text (`mailbox.running`, `mailbox.waiting`, `mailbox.inactive`).
  - **Result** (FR-007): none when `lastResult` is `unknown`; "Success" (`mailbox.syncjob_EX_OK`)
    with a check icon when `succeeded`; when `failed`, the legacy reason for the six recognised
    `exitStatus` codes (`mailbox.syncjob_<code>`), otherwise "Check log"
    (`mailbox.syncjob_check_log`) with a direct link to the run log. Every failure has a cross icon
    and the visually hidden prefix "Failed:".
  - **Last run** (FR-005, FR-051): `lastRunAt` as a `RelativeTime` with the absolute time
    available; when `null`, "Never" (`mailbox.never`) if `logAvailable` is false, and "Cleared,
    runs on the next cycle" if `logAvailable` is true, because only a reschedule clears the time
    of a job that has run (API `SyncJobRunStatus`).
- **Rationale**: legacy derives the icon from `success` and the text from `exit_status`
  (`js/site/mailbox.js`, `draw_sync_job_table`). The new rule keeps its texts, adds text to every
  icon, and does not show "Check log" for a success with an unparsed exit code, which FR-007 limits
  to failures. The `logAvailable` refinement keeps a rescheduled job from claiming it never ran.
- **Alternatives considered**: showing the raw `exitStatus` was rejected (not translated).
  Predicting the next run time was rejected (spec Assumptions).

## 3. Forms

### R9. Target mailbox picker and domain filter

- **Decision**: the shared pickers (R2), each a Reka `Combobox` without its viewport, with a
  300 ms debounce, 25 results per page and "load more" over `useInfiniteQuery`:
  - `MailboxSearchPicker.vue` over `listMailboxes` (`q`, `sort=address`), promoted from UI 006 at
    this second use. The API never lists resources, and aliases are a different collection, so
    only mailboxes are offered (FR-020). Each option shows the address and, when set, the display
    name. Used in the create form and, in its free-text mode, as the list's mailbox filter (exact
    address, as `GET /sync-jobs?mailbox=` expects). Its empty-result slot explains in the create
    form that a mailbox must exist first and, when `canAccess('mailboxes')` holds, links to
    Mailboxes (edge case).
  - `DomainPicker.vue` (domains source, single mode) over `listDomains` (`q`), for the list's
    domain filter, for administrators and domain administrators alike (the API scopes the list).

  Mailbox users get neither: their target is `identity.scope.mailbox`, shown read-only.
- **Rationale**: server-side search scales to thousands of mailboxes (FR-020). The combobox
  without `ComboboxViewport` is CSP-safe (001 R18). Reusing the shared pickers keeps one
  implementation per object type.
- **Alternatives considered**: a native `<select>` of the domain administrator's
  `scope.domains` (UI 006's choice for its quarantine filter) was rejected here: one control for
  both roles is simpler, and the scoped `listDomains` costs one small request. A free-text domain
  field was rejected, because `domain` matches exactly and partial input would match nothing.

### R10. Create form model and capabilities

- **Decision**: `src/features/sync-jobs/form-model.ts` holds the form values as an app-defined
  type derived from the generated `SyncJobCreateRequest` (no restated API shape, constitution I).
  - **Initial values** come from `getSyncJobsCapabilities().defaults` (FR-018, FR-055). The form
    renders after the capabilities read; its loading and error states use `ListState`.
  - **Port** (FR-019): starts at 993 for `ssl` and 143 for `starttls` and `plain`, and follows each
    encryption change while it still equals the standard port of the previous encryption and the
    user has not typed into it. On the details screen the same rule applies within one edit of the
    Source section. 993 and 143 are IMAP protocol constants, not server limits (FR-055).
  - **Encryption** options are `capabilities.encryptions`, as a radio group.
  - **Client checks** (FR-021): required fields; lengths from `capabilities.limits.*MaxLength`;
    whole numbers within `capabilities.limits.<field>.minimum`/`maximum`. Host format, the regular
    expression and the custom-parameter allow-list are left to the API, which is authoritative and
    whose legacy splitting rules (API `SyncJobCreateRequest.customParameters`) the app does not
    replicate.
  - **Help texts** show the ranges and lengths from the capabilities, and the custom parameters
    show `capabilities.customParameters.allowedOptions` as `--option` list (FR-021).
  - **Custom parameters permission** (FR-056): when `customParameters.allowed` is false, the
    create form omits the field (and never sends it), and the details screen shows the stored value
    read-only with the reason; the Expert options section then edits only "Simulate".
  - **Sections** (FR-016, FR-017): Target mailbox, Source, Schedule, Folders open; Duplicates and
    deletion, Limits and timeouts, Expert options collapsed below `md` (768 px, 001 R21) and open
    from `md` up. A collapsed header states how many of its values differ from
    `capabilities.defaults`. A section that holds a field with an error opens itself before focus
    moves (FR-022). Sections are Reka `Collapsible`s with `aria-expanded` on their trigger.
  - **Body** (create): every field, except that `mailbox` is omitted for mailbox users and
    `customParameters` is omitted when not allowed. Sending defaults explicitly keeps the request
    equal to what the user saw.
  - **Fields** (FR-049): numbers use `type="text" inputmode="numeric"` with an integer parser
    (avoids the wheel and exponent quirks of `type="number"`); host, username, pattern and
    parameters use `autocapitalize="none" autocorrect="off" spellcheck="false"`.
  - **Warnings** (FR-024): inline `role="note"` warnings under "Delete from source" and "Delete on
    destination" while switched on; "Simulate" carries its explanation permanently. Each option
    shows its imapsync option name in `<code>` as secondary text (FR-025); the names are literals,
    not translations.
  - **Leaving** (FR-027): the leave guard (R2) asks while the form holds input.
  - **Success** (FR-028): `router.replace` to the new job's details screen and a polite
    announcement. Replace, not push, so that Back does not return to an emptied create form.
- **Rationale**: FR-016 to FR-025 and FR-055; capabilities make operator configuration visible
  before submission instead of after a refusal.
- **Alternatives considered**: a form library was rejected (001 R1). Validating custom parameters
  in the browser was rejected: legacy's hyphen splitting is subtle, and two implementations would
  drift.

### R11. Details screen with section editing

- **Decision**: `SyncJobDetailPage.vue` shows a header (job label, state, last run, result,
  created and changed times, actions) and the seven sections of FR-016. Each section except Target
  mailbox is an `EditableSection` (002 D11), driven by the `edit=<section>` address parameter
  (`source`, `schedule`, `folders`, `duplicates`, `limits`, `expert`), one section at a time; below
  `md` the open section replaces the page content with its own heading and a sticky Save and
  Cancel bar, from `md` up it opens in place. Back therefore closes an open section.
  - **Read mode** shows the stored values (booleans as "On"/"Off" text with icons, empty values as
    "Not set").
  - **Edit** opens the section's fields with the stored values, using the same field components
    as the create form, and moves focus to the section heading (002 D11).
  - **Save** sends `PATCH /sync-jobs/{id}` (`application/merge-patch+json`) with only the fields of
    that section whose value differs from the loaded job, and `If-Match` with the loaded `etag`
    (FR-026, `useVersionedSave`). An unchanged section closes without a request. The response is
    written into the detail and list caches.
  - **Outdated** (`412`): the input stays, the job is reloaded, `changedSince()` marks the fields
    whose stored value changed with their new value, and the section offers "Save again" (the
    fields that differ from the reloaded job, with its version) and "Discard my changes"; no merge
    and no "overwrite anyway" (conventions, 002 D11).
  - **Leaving** (FR-027): the leave guard (R2) asks while a section holds changed input; "Cancel" in
    a section discards its input without asking. A reload with `edit` set reopens the section with
    the saved values; a typed password is never restored.
  - The **remote password** field in the Source section starts empty with the hint "A password is
    saved. Leave empty to keep it." (`remotePasswordSet`); empty is left out of the patch, non-empty
    replaces it (FR-030). A job without a stored password (possible for legacy rows) shows "No
    password is saved" instead.
  - The **target mailbox** is never part of a patch, so `immutable` cannot occur from this screen;
    it is still translated (R13).
  - Advanced sections are collapsed below `md` in read mode too (FR-017), with the same non-default
    counts.
- **Rationale**: conventions "Editing and conflicts" ask for per-section edit and save; small
  patches make conflicts rarer and keep the remote password out of every save that does not change
  it (SC-003).
- **Alternatives considered**: a separate edit page with the whole form (the first draft) was
  rejected by the conventions alignment recorded in the spec.

### R12. Remote password secrecy

- **Decision** (FR-029 to FR-035, SC-003):
  - The value lives only in the field component's local `ref`. It is never written to the query
    cache, router state, the address, storage or logs, and is cleared after a successful save,
    on "Cancel" and on unmount (the session-end path unmounts it, 001 R11).
  - Masked by default, with a reveal toggle button (`aria-pressed`, accessible name "Show
    password"/"Hide password"); it masks again on unmount (FR-031).
  - Autofill (FR-032): the remote username has `autocomplete="off"` and a name that is not
    `username`; the password has `type="password"`, `autocomplete="new-password"` and the
    password-manager opt-outs `data-1p-ignore`, `data-lpignore="true"`, `data-bwignore` and
    `data-form-type="other"`. The forms submit by script and never navigate, which also keeps
    browsers from offering to save the remote credentials as this site's sign-in.
  - The legacy notice `add.syncjob_hint` stands next to the field (FR-034). No request but the
    create and the Source section save carries the password; no third-party request exists in the
    app at all (constitution, FR-035).
  - **Verification**: `tests/e2e/sync-jobs/password-secrecy.spec.ts` types a marker password, runs
    the create and edit flows, and asserts the marker is absent from `page.content()` after saving,
    from every URL visited, from `localStorage`, `sessionStorage` and `history.state`, and present
    only in the bodies of `createSyncJob` and `updateSyncJob` among the mock's recorded requests.
- **Rationale**: browsers do not reliably honour `autocomplete="off"` on password fields;
  `new-password` plus the manager opt-outs is the established combination. The end-to-end test
  measures SC-003 directly.
- **Alternatives considered**: a `type="text"` field masked by CSS (`-webkit-text-security`) was
  rejected: not standard, and it defeats screen-reader password semantics.

### R13. Errors

- **Decision**: UI 001's `useProblemForm`, `ProblemMessage` and `messageKey()` handle every
  problem; UI 008 adds a field-specific layer in `field-messages.ts`:

  | Problem or rule | Where | Message |
  |---|---|---|
  | `422` `invalidFormat` `format: hostName` on `remoteHost` | field | "Enter a host name or an IPv4 address." (covers IPv6 literals, edge case) via `validation.format.hostName` |
  | `422` `invalidRegex` on `exclude` | field | "This is not a valid regular expression." |
  | `422` `optionNotAllowed` (`option`) on `customParameters` | field | "The option --{option} is not allowed on this server." |
  | `422` `optionContainsSpace` (`token`) | field | "Write \"{token}\" as --option=value, without spaces." |
  | `422` `customParamsNotPermitted` | field | "Only administrators may set custom parameters on this server." and the capabilities are refetched |
  | `422` `notEligible` (`kind`) on `mailbox` | field | "This address is a {kind} and cannot receive synced mail." (`kind` translated) |
  | `422` `immutable` on `mailbox` | field | "The target mailbox cannot be changed." |
  | `422` `outOfRange` (`min`, `max`), `tooLong` (`max`), `required` | field | UI 001's generic `validation.*` with formatted numbers |
  | `409 sync-job-exists` (`syncJobId`) | form alert | "A sync job for this mailbox, remote username and host already exists." with "Open the existing job" linking to `/sync-jobs/{syncJobId}`; values kept (FR-023) |
  | `412` | section or dialog | conventions: reload, mark, retry (R11, R14) |
  | `404` | page or action | "This sync job no longer exists." and the list refreshes (edge case) |
  | `403 permission-flag-required` | page | identity refresh, then `NoAccessState` (R4) |
  | network failure, `500`, non-problem 5xx | page or action | UI 001's retry message with the request ID |

  Unknown rule codes fall back to `validation.invalid` (001 R15). API 008 documents no `429` or
  `503` for these operations, so they cannot be mocked (the validator rejects undocumented
  statuses); UI 001's generic handling covers them if they ever occur.
- **Rationale**: FR-022, FR-023, FR-047; problem types and rule codes are translated in the UI
  (conventions "Errors and permissions").
- **Alternatives considered**: showing `detail` or `errors[].message` was rejected: English only
  (001 R8).

## 4. Actions

### R14. Single-job actions

- **Decision** (FR-036, FR-038, FR-039):
  - **Activate / Deactivate**: `PATCH /sync-jobs/{id}` with `{ "active": true|false }` and
    `If-Match: etag` as shown. Deactivating first asks one explicit confirmation through
    `useConfirm` that names the job and says that it will not run until activated again (and, when
    running, that the run in progress finishes on its own); activating does not (conventions
    "Confirmations", spec clarification). A `412` says the job changed, reloads it (list row or
    details) and leaves the action available for a retry.
  - **Schedule next**: `POST /sync-jobs/{id}/schedule-reset` without `If-Match`.
  - **Delete**: confirmation (R16), then `DELETE` with `If-Match`; a `412` reloads the job and asks
    again.
  - Each result is announced politely and written into the caches. When the job was running, the
    announcement or confirmation adds "The run in progress is not interrupted and finishes on its
    own." (FR-038).
  - The same composable (`useSyncJobActions.ts`) serves the card menu, the table row menu and the
    details header, so the behaviour cannot drift.
- **Rationale**: the contract's single-object operations, and conventions' version handling and
  confirmations.
- **Alternatives considered**: sending single actions through the bulk operation with one target
  was rejected: the single operations return the updated job and the precise status codes.
  Deactivating without confirmation, as legacy does and as the first draft of the spec asked, was
  rejected: `docs/conventions.md` names deactivating among the actions that need one explicit
  confirmation, and UI 002 confirms domain deactivation the same way.

### R15. Bulk actions

- **Decision** (FR-037, SC-008): the shared bulk parts (R2) on the current page's jobs.
  - **Selection mode**: `BulkActionBar`'s "Select" control starts it (002 D22). Each card and row
    gets a 44 × 44 px checkbox with the job's label as its accessible name, the table gets "select
    all on this page", and the bar, fixed at the bottom on phones, names the count and offers
    Activate, Deactivate, Schedule next and Delete, wrapping rather than scrolling sideways at
    360 px. Changing page, search, filters, sort or size clears the selection (`useListState`'s
    `onReset`).
  - **Limit**: `capabilities.bulkLimit` (read when selection mode starts) is given to
    `useBulkSelection`'s `limit` option (004 D2), so a selection never exceeds it and the bar says
    so; the request therefore never names more jobs than the limit. With page sizes up to 100 and
    the default limit of 100 it matters only on servers with a lower limit.
  - **Confirmation**: Deactivate asks one explicit confirmation that lists the selected jobs and
    says that they will not run until activated again (002 D22 does the same for domains); Delete
    follows R16; Activate and Schedule next run at once.
  - **Request**: `POST /sync-jobs/bulk-actions` `{ action, targets: [{ id: String(job.id),
    version: job.etag without its quotes }] }`; the version is sent for `reschedule` too and
    ignored there by the API. While it runs, an indeterminate progress indicator says "Processing
    n sync jobs" and is announced (002 D22).
  - **Summary**: `BulkResultSummary` rows `{ id, label, outcome, problem }`, named by the job's
    label from the selection snapshot, outcome translated (`done`, `notFound`, `refused`,
    `outdated`, `failed`) with the item problem's translated message. `done` and `notFound` leave
    the selection; `refused`, `outdated` and `failed` stay selected, and "Retry" sends exactly those
    with the version tags of the refreshed list (002 D22). A note says when a selected job was
    running (FR-038). The counts are announced.
  - **Network failure**: every selected job is reported "outcome unknown", nothing is retried, the
    selection is cleared and the list is refetched (002 D22, conventions).
  - Afterwards the lists and `['audit-events']` are invalidated and the details of deleted jobs are
    removed from the cache.
  - Automatic refresh is suspended while selection mode is on (R7).
- **Rationale**: conventions "Bulk actions" and API 008 FR-023, FR-024.
- **Alternatives considered**: selections across pages were rejected by the conventions.

### R16. Delete confirmations

- **Decision**: `useConfirm` with destructive styling (FR-039, US6):
  - **One job**: the dialog names the source (`user@host:port`) and the target mailbox, says that
    mail already copied stays in the mailbox, and adds the running note when the job runs.
    Confirming from the details screen returns to the list (`router.replace`) and announces the
    deletion; from the list, the job disappears and focus moves to the list heading.
  - **Several jobs**: the dialog lists every selected job in a scrollable list with an accessible
    name, says that copied mail stays, and requires the number of jobs to be typed
    (`requireTyped`, conventions, 004 D5).
  - Focus starts on Cancel; cancelling returns focus to the control that opened the dialog (Reka
    `AlertDialog`).
- **Rationale**: conventions "Confirmations"; API 008 has no delete preview, so the dialog shows
  the job's own data.
- **Alternatives considered**: typing a job's host for a single deletion was rejected: the
  conventions reserve typed names for domains.

## 5. Run log, history, i18n

### R17. Run log viewer

- **Decision** (FR-041 to FR-046, SC-007):
  - **Opening**: from the result's "Check log" link, the card and row menus ("Open logs",
    `mailbox.open_logs`) and the details header. Opening pushes `?log=<id>` onto the current page's
    address (list or details); closing goes back when the viewer was opened in the app, and
    otherwise replaces the address without `log`. So Back closes the full-screen view on phones,
    and a log can be linked for support. On the list, `log` is a view parameter of the list state
    (R6). An identifier the user cannot reach shows the "not found" message inside the viewer.
  - **Presentation**: `SyncJobLogDialog.vue` on Reka `Dialog` (no style-injecting parts, 001 R18):
    full screen below `md`, a large dialog (up to 64 rem wide, 90 vh high) from `md` up. Its header
    shows the source, target mailbox, last run time and last result; actions are Copy, Wrap lines
    (a toggle, on by default), Refresh and Close.
  - **Fetching**: `GET /sync-jobs/{id}/log` only when the viewer opens (FR-046), never with the
    list. `runStatus` from the response refreshes the header.
  - **States** (FR-045), decided in `log-view.ts`: the text when `log` is not empty; "No log yet"
    when it is empty and the job never ran (`lastRunAt` is `null` and `logAvailable` is false);
    "The run produced no output" when it is empty otherwise; plus a notice "A run is in progress.
    This is the log of the previous run." with Refresh when `runStatus.running`.
  - **Rendering**: text interpolation only, never `v-html` (FR-042). The log comes from a remote
    server, so it is untrusted text: each chunk goes through UI 006's
    `neutralise(text, { multiline: true })` (`src/shared/security/plain-text.ts`, 006 R9), which
    shows control and bidi override characters as visible markers (for example `U+202E`) instead
    of letting them reorder or hide text, and renders inside a `dir="auto"` block with
    `unicode-bidi: plaintext`. Everything else is shown verbatim. The text is split once at line
    breaks into chunks of 500 lines, each rendered as a block with `white-space: pre-wrap` (or
    `pre` when wrapping is off) and `content-visibility: auto` with an intrinsic size of 500 lines,
    so the browser lays out and paints only the visible chunks. Chunking keeps every character,
    and Copy uses the original string, so the copied text is byte-identical to the API's. The log
    area is a `role="region"` with an accessible name and `tabindex="0"`, scrollable by keyboard;
    with wrapping off only this area scrolls sideways (FR-043). Text stays in the accessibility
    tree and findable with the browser's search, because `content-visibility: auto` does not hide
    content.
  - **Copy** (FR-044): `src/shared/platform/clipboard.ts`; success or refusal is announced, and on
    refusal the visible chunk of text can be selected manually.
  - **Memory**: the log string is held in a `shallowRef`; the query's `gcTime` of 60 s frees it
    soon after closing (R5).
  - **Performance check**: `tests/e2e/sync-jobs/log-performance.spec.ts` (Chromium, 4× CPU
    throttling) opens a 5 MB log and expects it readable in under 3 s, and a scroll to the end with
    no long task over 200 ms.
- **Rationale**: a single 5 MB text node with wrapping forces layout of the whole log on every
  resize and toggle; `content-visibility` gives virtualisation's benefit without its costs
  (variable line heights, broken find-in-page and selection). It is supported by the two latest
  versions of every evergreen browser, including Safari 18.
- **Alternatives considered**: line virtualisation was rejected (variable wrapped heights, no
  find-in-page). A `<textarea readonly>` (legacy) was rejected: poor semantics and no wrap control.
  Downloading the log was rejected by the spec.

### R18. History and audit labels

- **Decision**: administrators get a History action in the details header, rendered with
  `HistoryLink` (`targetType=syncJob`, `targetId=<id>`). Following conventions "History and audit",
  UI 008 adds the audit log labels for `syncJobCreation`, `syncJobUpdate`, `syncJobReschedule` and
  `syncJobDeletion`, the target type `syncJob`, and the failure reasons `permissionDenied` and
  `notFound` unless an earlier feature listed them, in all three locales, and appends them to the
  enumeration scope manifest (R19). API 008 writes no `details` members that the contract
  describes, so the audit log shows them through UI 001's generic details view (as 002 D26 does).
- **Rationale**: FR-015 and API 008 FR-026; only administrators may read the audit log.
- **Alternatives considered**: a per-job history panel inside the details screen was rejected: the
  audit log screen already exists.

### R19. Translations

- **Decision** (FR-052, constitution IV):
  - New messages under `syncJobs.*` in `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`.
  - Legacy reuse through `src/i18n/legacy-map.json` (meaning unchanged): the titles
    `mailbox.sync_jobs`, `user.create_syncjob`, `add.syncjob`, `edit.syncjob`; the notice
    `add.syncjob_hint`; the field labels `add.hostname`, `add.port`, `add.enc_method`,
    `add.username`, `add.password`, `add.mins_interval`, `add.exclude`, `add.timeout1`,
    `add.timeout2`, `add.delete1`, `add.delete2`, `add.delete2duplicates`, `add.automap`,
    `add.skipcrossduplicates`, `add.subscribeall`, `add.dry`, `add.custom_params`,
    `add.custom_params_hint`, `add.active`, `edit.encryption`; the list labels `mailbox.owner`,
    `mailbox.last_run`, `mailbox.syncjob_last_run_result`, `mailbox.running`, `mailbox.waiting`,
    `mailbox.inactive`, `mailbox.never`, `mailbox.open_logs`, `mailbox.last_run_reset`,
    `mailbox.mins_interval`, `mailbox.excludes`; the results `mailbox.syncjob_EX_OK`, the six
    `mailbox.syncjob_EXIT_*` and `mailbox.syncjob_check_log`; the actions `mailbox.activate`,
    `mailbox.deactivate`, `mailbox.remove`, `admin.refresh`, `edit.save`. All exist in the
    upstream `2026-09a` files of en-gb, cs-cz and sk-sk (checked while planning), so no locale
    needs a hand-written fallback.
  - Legacy texts with markup (`edit.subfolder2`, `edit.maxage`, `edit.maxbytespersecond`) get new
    keys that separate label and hint (`syncJobs.fields.subfolder`/`subfolderHint`, `maxAge`/
    `maxAgeHint`, `maxBytesPerSecond`/`maxBytesPerSecondHint`). UI 002 D27's `stripMarkup` mapping
    is not used for them, because it would join label and hint into one text.
  - **Closed enumerations** this feature introduces into the UI are fully required: UI 008 adds
    `syncJobEncryptionValues` → `enums.syncJobEncryption`, `syncJobLastResultValues` →
    `enums.syncJobLastResult` and `syncJobBulkActionValues` → `enums.syncJobBulkAction` to
    `ENUM_NAMESPACES` in `scripts/i18n/lib.mjs` (`bulkItemOutcomeValues` already comes from UI 002;
    the generated array names are confirmed against `src/api/generated/schema.ts` at T003), and
    `hostName` joins the checked `validation.format.*` keys.
  - **Growing shared enumerations** use UI 002 D2's scope manifest: UI 008 appends
    `AuditEventType` `syncJobCreation`, `syncJobUpdate`, `syncJobReschedule`, `syncJobDeletion`;
    `AuditTarget.type` `syncJob`; `AuditFailureReason` `permissionDenied`, `notFound`;
    `ValidationRuleCode` `invalidRegex`, `optionNotAllowed`, `optionContainsSpace`,
    `customParamsNotPermitted`; and the problem types `sync-job-exists` and
    `permission-flag-required` (each unless already listed), with their messages.
- **Rationale**: carries the legacy cs-cz and sk-sk translations over and keeps CI's completeness
  gate meaningful for the new enumerations.
- **Alternatives considered**: reusing `user.*` duplicates of the same texts was rejected; one
  mapping per meaning is enough.

## 6. Testing and budgets

### R20. Mock API for sync jobs

- **Decision** (001 R22): `tests/mocks/handlers/sync-jobs.ts` implements the 9 operations on
  scenario state, typed with `openapi-msw` and validated by the contract validator:
  - **Scope and flags** from the scenario account (001 identity handler): `403
    permission-flag-required` with `requiredFlags: ["syncjobs"]` before any lookup; out-of-scope
    jobs and mailboxes answer `404`.
  - **List**: `q` over mailbox, remote user and host; filters `mailbox` and `domain` (exact,
    case-insensitive), `active`, `running`, `lastResult`; every sort of `SyncJobSort` with ties by
    `id`; paging and `ListMeta`.
  - **Create** and **update**: the documented rule codes with parameters (`required`, `tooLong`,
    `outOfRange`, `invalidFormat` `hostName` for IPv6 literals and malformed names, `invalidRegex`
    for patterns with unbalanced brackets or parentheses (a deterministic stand-in for PCRE),
    `optionNotAllowed`, `optionContainsSpace`, `customParamsNotPermitted`, `notEligible`,
    `immutable`); `409 sync-job-exists` with `syncJobId` on a case-insensitive duplicate of
    mailbox, remote user and host; `If-Match` and `412`; `Location` and `ETag`; a new `etag` on
    every configuration change and never on run-status changes; `remotePassword` stored in scenario
    state for assertions and never returned.
  - **Reschedule** clears `lastRunAt` and `lastResult` and keeps the `etag`. **Delete** answers
    `204`.
  - **Bulk**: per-item outcomes in request order, `outdated` on a version mismatch (not for
    `reschedule`), `notFound`, duplicates processed once, `422 tooMany` above the scenario's bulk
    limit, and failure injection per job id (`failed` with a problem).
  - **Log**: the scenario's log text and run status.
  - **Capabilities**: from the scenario (defaults, limits, `customParameters.allowed`,
    `allowedOptions`, `bulkLimit`).
  - **Runtime changes** through `PATCH /__mock/scenarios/:id` (001 T028): finish or start a run,
    change a job as "another user" (new `etag`), delete a job, revoke the `syncjobs` flag.
  - Scenarios live in `tests/mocks/scenarios/sync-jobs.ts`, built with
    `tests/mocks/factories/sync-job.ts`; the names are listed in data-model §8.
- **Rationale**: stateful handlers are needed for the conflict, bulk and refresh stories; the
  validator guarantees that nothing the contract forbids is mocked (for example an `exitStatus`
  longer than 50 characters).
- **Alternatives considered**: compiling PCRE in the mock was rejected: the mock tests the UI's
  handling of `invalidRegex`, not the regex engine.

### R21. Test layers

- **Decision**:
  - **Unit and component** (Vitest, `tests/unit/features/sync-jobs/`): list state, presentation
    tables, form model (defaults, port rule, diff, non-default counts, client checks against
    capabilities), field messages, log view (chunking that preserves every character, states),
    `useRunningRefresh` (fake timers and visibility), `useLogViewer`, `useSyncJobActions`, and the
    main components.
  - **End-to-end** (Playwright, `tests/e2e/sync-jobs/`): every acceptance scenario of US1 to US6
    and the listed edge cases, titled with their spec IDs, on `mobile-chromium` (360 px),
    `desktop-chromium` and `mobile-webkit`, with `expectAccessible` in both themes on every screen
    and state, `expectNoHorizontalScroll` at 360 and 320 px, `expectTouchTargets`, and zero CSP and
    contract violations (001 R24). Start from active-session scenarios.
  - **Smoke** (`tests/smoke/sync-jobs.smoke.spec.ts`) against the API dev stack seeded by API 008
    T066 (alice with jobs #1 and #2, bob without the flag, carol's job #3, `reseller` with the
    flag). Created jobs are deleted at the end.
- **Rationale**: constitution VI and SC-003, SC-004, SC-006, SC-007, SC-008.

### R22. Performance budget

- **Decision**: the three pages are lazy route chunks; the log viewer is a lazy component loaded
  on first open. No new dependency, so the initial JavaScript is unchanged; `budget:check` prints
  the new chunk sizes, expected under 25 KB gzipped together.
- **Rationale**: constitution VII; 001 R26.
