# Implementation Plan: Sync Jobs

**Branch**: `main` (no feature branches, constitution 1.1.0) | **Date**: 2026-10-18 |
**Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-sync-jobs/spec.md`

## Summary

UI feature 008 replaces the classic interface's sync job tabs, add modals, edit page and log modal
for administrators, domain administrators and mailbox users. It delivers:

- a **list** of the jobs in the user's scope, with state, last run and last result, as cards on
  phones and a sortable table on wide screens, with search, filters and paging in the address, a
  pre-filtered entry from UI 003's mailbox detail, and an automatic refresh while a job runs;
- a sectioned **create form** whose advanced sections stay collapsed on phones, with defaults,
  limits and the custom-parameter permission from API 008's capabilities read;
- a **details screen** whose sections each have their own edit and save, with the write-only remote
  password, conflict handling and a History action;
- **activate, deactivate, schedule next run and delete**, for one job and for a selection through
  API 008's bulk operation, with per-job results;
- a **run log viewer**: full screen on phones, a large dialog on wide screens, verbatim, copyable
  and fast with 5 MB logs.

The technical approach (details in [research.md](./research.md)):

- **No new dependency.** UI 001's stack, client, query policy, mock API and test layers are used
  as they are. One feature area, `src/features/sync-jobs/`, with pure logic modules for the list
  state, presentation, form model, field messages and log view (R3).
- **Contract**: the 9 sync-job operations of API 008 plus `listMailboxes`, `listDomains`,
  `listAuditEvents` and `getIdentity`, from a pin at or after mailcow-rest-v2 commit `3207925`
  (R1).
- **Reuse** (R2): bulk selection, the bulk action bar, typed confirmation, section editing driven
  by the `edit` address parameter, the leave guard and `HistoryLink` from UI 002; the mailbox
  detail screen and its header actions from UI 003; the shared `DomainPicker` (UI 003, promoted by
  UI 004); `MailboxSearchPicker`, promoted from UI 006 at this second use; UI 006's `neutralise()`
  for the untrusted log text; the shell, list state, forms, dialogs and announcer from UI 001.
- **Server state**: new query roots `['sync-jobs', …]`; the list's only `refetchInterval`, bound to
  running jobs, visibility, selection mode, a pause control and UI 011's inactivity limit of
  `min(15 min, session idle timeout)` (R5, R7).
- **Secrets**: the remote password lives in one component `ref`, never in caches, the address,
  storage or logs, and an end-to-end test proves it (R12).
- **Log viewer**: an address parameter so Back closes it, and chunked rendering with
  `content-visibility: auto` for large logs (R17).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) and Vue 3.5 SFCs; Node.js 24 LTS for tooling
(UI 001 plan).

**Primary Dependencies**: unchanged from UI 001 research R1/R2 (`vue`, `vue-router`,
`@tanstack/vue-query`, `pinia`, `vue-i18n`, `reka-ui`, `openapi-fetch` and the others). No runtime
or development dependency is added.

**Storage**: none on a server. In the browser: the query cache and component state. No new device
storage key; the remote password never reaches any storage (FR-033).

**Testing**: Vitest and Vue Test Utils for units and components; Playwright on `mobile-chromium`
(360 px), `desktop-chromium` and `mobile-webkit` with axe in both themes against the
contract-validated mock; a smoke spec against the API dev stack (UI 001 research R22 to R25).

**Target Platform**: as UI 001: the two latest major versions of evergreen browsers, served under
`/ng/` next to mailcow-rest-v2.

**Project Type**: web application (static single-page frontend; the backend is mailcow-rest-v2).

**Performance Goals**: a 5 MB run log readable in under 3 s on a mid-range phone and scrolling
without stalls (SC-007); initial JavaScript unchanged (lazy routes); the three page chunks plus the
log viewer under 25 KB gzipped.

**Constraints**: only contract operations; WCAG 2.2 AA in both themes; 360 px and 320 px without
horizontal scrolling; strict CSP (no inline style, no `v-html`); no automatic requests while the
user is idle beyond the bounded refresh of R7; limits and defaults never hard-coded (FR-055).

**Scale/Scope**: 6 user stories (3 at P1, 3 at P2); 3 routes and one address-driven dialog; 13
operations; 3 locales; about 150 new translation keys, about 55 of them reused from legacy; one
entry point into UI 003.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|---|---|---|
| I. The API contract is the only interface | Only the 13 operations of [contracts/README.md](./contracts/README.md), through `@/api`. The pin is recorded in `contract/VERSION.json` and verified against the baseline (R1). No hand-written API type: form values and view models derive from generated types (data-model §2). The first draft's three API gaps are closed by the contract; none is open, and nothing is worked around. Errors come from problem `type`, rule `code` and `params` (R13). | PASS |
| II. Mobile-first | Designed at 360 px first: cards below `md`, a table from `md` up; advanced form sections collapsed on phones; the log full screen on phones; the selection bar wraps instead of scrolling; 44 × 44 px targets; a top-of-page create action (FR-048). Deleting is confirmed with the jobs named, and several deletions need the count typed. Loading, empty, no-match and error states on the list, details, pickers and log. | PASS |
| III. Accessibility (WCAG 2.2 AA) | axe in both themes on every screen and state of the end-to-end tests. State and result use icons with text; table headers with `aria-sort`; a heading per card; keyboard-scrollable log region; announced saves, deletions, summaries, copies and result counts; the automatic refresh can be paused (WCAG 2.2.2) and announces nothing on its own (R7, R8, R17). | PASS |
| IV. i18n and branding | All text in `syncJobs.*` for en-gb, cs-cz and sk-sk; about 55 legacy keys reused through `legacy-map.json`, all present in the upstream sk-sk file; markup-carrying legacy texts replaced by label and hint keys; new contract enumerations required by `i18n:check` (R19). Locale formatting for times and numbers. No brand data. | PASS |
| V. Security in the browser | The remote password is masked, protected from autofill and saving, held in one component `ref`, sent only by create and Source saves, never stored, cached, logged or put in the address, and never sent to a third party; an end-to-end test proves it (R12). The log is rendered as text, never as HTML (R17). Hiding the entry is a convenience: `permission-flag-required`, `404` and `412` are handled (R4, R13). | PASS |
| VI. Test-first | `tasks.md` writes the mock, unit, end-to-end and smoke tests before each story's implementation. Every acceptance scenario of US1 to US6 has an end-to-end test on both viewports against the contract-validated mock; the 5 MB log and the password secrecy have dedicated tests (R20, R21). | PASS |
| VII. Performance budgets | No new dependency; lazy routes and a lazy log viewer; `budget:check` unchanged initial JS (R22). Server state cached, written from responses and invalidated after mutations; the log is fetched only when opened; the only interval is bounded by running jobs, visibility, selection, a pause control and inactivity (R5, R7). | PASS |
| VIII. Simplicity | No new dependency. Shared parts are reused from UI 001 to UI 006; `MailboxSearchPicker` is promoted at its second use. Single-use parts stay in the feature (`useRunningRefresh`, `useInactivity`, the log viewer), with UI 011 as the recorded promotion point for `useInactivity`. Only possibly-missing small shared parts are added where their owners placed them (R2). | PASS |
| Technology constraints | Stack unchanged; Reka parts without style injection; no TailAdmin Pro code; no CDN request. | PASS |
| Workflow and gates | Commits to `main`; CI gates of UI 001 unchanged; this feature names its API dependency and contract pin (R1). | PASS |
| `docs/conventions.md` | Wording ("the classic interface" where it appears). List state in the address, page sizes 25/50/100, cards and tables, list states. Bulk actions: page-only selection, one bulk request with versions as listed, per-item summary, failed/refused/outdated stay selected, "outcome unknown" without retry. Section editing with only changed fields and the read version; outdated saves keep input, reload and mark, no overwrite. Confirmations: single delete with impact, bulk delete with typed count, one explicit confirmation for deactivating (single and bulk). Secrets: write-only remote password. History via target filters, and audit labels for the four sync-job event types. Problem types and rule codes translated. Capabilities from the capabilities read. Entry point into UI 003 through its action area, shown only when UI 008 exists. | PASS |

**Post-design re-check (after Phase 1)**: PASS. The data model, contracts README and quickstart
introduce no violation. Decisions that touched gates:

- The list's `refetchInterval` is the single, bounded exception to UI 001 R9's "no interval", with
  the inactivity pause that UI 001 FR-033 and UI 011 FR-021 imply (VII, V; R7).
- The log viewer's chunked `content-visibility` rendering instead of a virtualisation library
  (VIII; R17).
- Custom parameters hidden or read-only from the capabilities read, instead of a refusal after
  submission (I, conventions; R10).

## API dependency and gaps

This feature depends on **mailcow-rest-v2 feature 008** (contract module `api/modules/sync-jobs/`,
last changed in `0fb4f73`), pinned at commit `32079252d55797d3da4e58ae661e9fb91c51c6f9` or later
(see [contracts/README.md](./contracts/README.md)), and on operations of API 001, 002 and 003 that
earlier UI features already pin. The API's implementation is not required: the feature is built and
tested against the contract-validated mock, and its smoke spec runs once the API's dev stack serves
feature 008 (UI 001 plan, Complexity Tracking).

**API gaps**: none open. The spec's three gaps (custom-parameter restriction not readable, target
mailbox editability unspecified, exclusion-pattern default) are closed by API 008's capabilities
read, the `immutable` rule and the `(?i)spam|(?i)junk` default.

Observations, none blocking:

1. `listMailboxes` returns full mailbox representations, so the picker loads more data per option
   than it shows. Acceptable at 25 per page; no change is requested.
2. API 008 documents no `429` or `503` for its operations. The spec's retry wording is aligned
   (FR-047); UI 001's generic handling covers them if they ever occur.

## Consistency changes to the spec

Recorded in the spec's Clarifications (session 2026-10-18) and checklist (validation run 3):

1. Multi-job actions use `POST /sync-jobs/bulk-actions` with `targets` (id and version as listed)
   instead of one request per job (FR-037, US4-AS3, US6-AS3, edge case on dropped connections).
2. The details screen edits one section at a time and marks changed values after an outdated save
   (FR-016, FR-017, FR-026 to FR-028, US3).
3. Deleting several jobs needs their number typed (FR-039).
4. History action through the audit log's target filters (FR-015); page sizes 25/50/100 (FR-012).
5. The automatic refresh can be paused, is suspended in selection mode and pauses after 15 minutes
   of inactivity, or the session's idle lifetime if shorter (FR-014).
6. Defaults, limits, the bulk limit and the custom-parameter permission come from the capabilities
   read (FR-018, FR-021, FR-055, FR-056); the exclusion pattern is now the API's default.
7. `permission-flag-required` replaces "forbidden", `sync-job-exists` links to the existing job,
   and the retry wording follows the documented statuses (FR-023, FR-047); the domain list and the
   audit log join the used operations (FR-053).
8. Deactivating asks one explicit confirmation, for one job or a selection (FR-036, FR-037,
   US4-AS1), and a dropped connection during a bulk action clears the selection, as UI 002 does.

## Dependencies on earlier features

UI 008 is implemented after **UI 001 to UI 007** and after **API 008's contract** is merged (it is).
Specifically (research R2):

- **UI 001**: shell, router, catalogue entry `syncJobs`, `canAccess`, `NoAccessState`, list state,
  forms, dialogs, announcer, clipboard, mock server and fixtures, i18n tooling.
- **UI 002**: `useBulkSelection`, `BulkActionBar`, `BulkResultSummary`, `ConfirmDialog` with
  `requireTyped`, `EditableSection` driven by `edit` with `changedSince()`, the leave guard,
  `HistoryLink` and the audit log's target filters, the enumeration scope manifest, the domain
  list mock.
- **UI 003**: the mailbox list mock and mailbox state, `NotFoundState`, and the mailbox detail
  screen whose header page actions (a designated action area) receive "Sync jobs".
- **UI 004**: the shared `DomainPicker`, `useBulkSelection`'s `limit` option, `SearchField`,
  `requiredFlags` on `ApiProblem`.
- **UI 005**: the `permission-flag-required` session reaction (also planned by UI 004).
- **UI 006**: `MailboxSearchPicker` (promoted here), `neutralise()`, `FilterPanel`.
- **UI 007**: no direct dependency; its contract pin precedes UI 008's.

Task T004 verifies these parts before any other work. A missing part blocks UI 008 and goes back to
its owner; only the `permission-flag-required` session reaction, the mailbox search picker and a
"view" parameter of `useListState` are added by UI 008 if still missing (T005 to T010).

## Owner-level questions (defaults applied)

1. **Review of new Czech and Slovak strings**: **Default**: as in UI 001, the owner reviews the new
   cs-cz and sk-sk strings before release; T075 lists them.

## Parity notes added by the plan

The spec's parity table is complete. The plan adds:

1. A job whose last run was cleared by "Schedule next" reads "Cleared, runs on the next cycle"
   instead of the classic "Waiting" in the last-run column (research R8).
2. A success whose exit code the runner did not recognise reads "Success", where the classic
   interface showed "Check log" next to a success icon (research R8).
3. The log can be linked by address and closed with Back on phones (research R17).
4. Deactivating asks one explicit confirmation, where the classic interface deactivates at once
   (conventions "Confirmations", research R14).

## Project Structure

### Documentation (this feature)

```text
specs/008-sync-jobs/
├── spec.md              # Feature specification (clarifications, parity, consistency changes)
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R22
├── data-model.md        # Phase 1: consumed API data, view models, cache, routes, validation, state machines, scenarios
├── quickstart.md        # Phase 1: gates and validation guide
├── contracts/README.md  # Phase 1: pinned contract and operations used
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

The `/speckit-analyze` summary is reported to the orchestrator, which records it.

### Source Code (repository root)

New files of this feature, and the existing files it edits:

```text
src/features/sync-jobs/
├── index.ts                         # routes, MailboxSyncJobsLink
├── routes.ts                        # sync-jobs, sync-job-create, sync-job-detail
├── api.ts                           # queries, mutations, cache writes and invalidation (data-model §3)
├── list-state.ts                    # useListState schema (data-model §5)
├── presentation.ts                  # job label, state, result, last run (data-model §2)
├── form-model.ts                    # values, sections, port rule, non-default counts, bodies, patches, checks
├── field-messages.ts                # (field, rule) → message key (research R13)
├── log-view.ts                      # log states and chunking
├── composables/
│   ├── useRunningRefresh.ts         # research R7
│   ├── useInactivity.ts             # research R7 (UI 011 promotes it)
│   ├── useLogViewer.ts              # research R17
│   └── useSyncJobActions.ts         # single and bulk actions (research R14, R15)
├── components/
│   ├── SyncJobStateBadges.vue  SyncJobResult.vue  SyncJobLastRun.vue
│   ├── SyncJobCard.vue  SyncJobTable.vue  SyncJobList.vue  SyncJobFilters.vue
│   ├── SyncJobRowActions.vue  AutoRefreshControl.vue  SyncJobDeleteList.vue
│   ├── FormSection.vue  SourceFields.vue  RemotePasswordField.vue  ScheduleFields.vue
│   ├── FolderFields.vue  DuplicateFields.vue  LimitFields.vue  ExpertFields.vue
│   ├── SyncJobSectionValues.vue     # read mode of a details section
│   ├── SyncJobLogDialog.vue  SyncJobLogText.vue
│   └── MailboxSyncJobsLink.vue
└── pages/
    ├── SyncJobsPage.vue
    ├── SyncJobCreatePage.vue
    └── SyncJobDetailPage.vue

# Existing files edited
src/api/query/keys.ts                       # sync-jobs keys; picker keys if missing
src/api/query/client.ts                     # permission-flag-required reaction, only if missing (T006)
src/shared/composables/useListState.ts      # view parameter, only if missing (T010)
src/shared/components/MailboxSearchPicker.vue  # promoted from UI 006's rate-limits feature (T008)
src/features/rate-limits/…                  # imports of the promoted picker updated (T008)
src/app/navigation/catalogue.ts             # syncJobs → available
src/app/router/routes.ts                    # register sync-jobs routes
src/features/mailboxes/pages/MailboxDetailPage.vue   # MailboxSyncJobsLink in the header page actions
src/features/audit-log/labels.ts            # sync-job event and target labels, if labels are mapped there
src/i18n/messages/{en-gb,cs-cz,sk-sk}.json  src/i18n/legacy-map.json  src/i18n/legacy/*.json (generated)
src/i18n/coverage.json                      # scope manifest of UI 002 D2 (enum-scope.json in UI 003)
scripts/i18n/lib.mjs                        # ENUM_NAMESPACES: sync-job enumerations; hostName format

tests/
├── mocks/
│   ├── factories/sync-job.ts
│   ├── scenarios/sync-jobs.ts              # registered in scenarios/index.ts
│   └── handlers/sync-jobs.ts               # registered in handlers/index.ts
├── unit/features/sync-jobs/*.spec.ts
├── e2e/sync-jobs/*.spec.ts
└── smoke/sync-jobs.smoke.spec.ts
```

**Structure Decision**: UI 001's single frontend project, organised by feature. Sync jobs are one
feature area that other code reaches only through `index.ts`; shared building blocks come from
`src/shared/` as UI 001 R20 assigned them.

## Complexity Tracking

No constitution violation needs justification. The one deviation from a UI 001 rule, the list's
condition-bound `refetchInterval`, is required by FR-014 and justified in research R7.
